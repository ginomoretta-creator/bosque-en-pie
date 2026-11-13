// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Bosque en pie
/// @notice Pago por conservar monte, verificado por satélite.
///         Un donante (por ejemplo, una empresa) deja AVAX en el pozo de una parcela. Cada informe
///         firmado que confirma el monte en pie paga una cuota al dueño y al operador. Dos lecturas
///         malas seguidas cortan los pagos para siempre. Reglas completas en CLAUDE.md (1 a 10).
interface IERC1155Receiver {
    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes calldata data)
        external
        returns (bytes4);

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);
}

contract BosqueEnPie {
    // ---------------------------------------------------------------- tipos

    enum Status { None, Standing, Review, Cleared, Closed }
    enum Choice { Refund, Restoration }

    struct Parcel {
        address owner;
        address operator;
        uint256 fee;              // cuota por informe bueno, en wei
        uint16 thresholdBps;      // coverBps mínimo para "en pie"
        uint16 ownerShareBps;     // parte de la cuota para el dueño; el resto, al operador
        uint32 hectares;
        uint64 commitEnd;         // fin del compromiso (0 = sin plazo)
        uint64 lastObs;           // fecha de imagen del último informe aplicado
        Status status;
        uint256 balance;          // saldo del pozo
        uint256 totalRefundStake;
        uint256 totalRestoreStake;
        // Fotos tomadas una sola vez al corte o al cierre. No cambian después.
        uint256 refundPool;
        uint256 restorePool;
        uint256 leftoverPool;
        uint64 endedAt;
    }

    struct Report {
        uint64 tObs;
        uint16 coverBps;
        uint16 validBps;
        bytes32 evidenceHash;
        uint8 signersMask;        // bit i = firmó el verificador i
    }

    struct Pending {
        bool active;
        bool challenged;
        uint64 submittedAt;
        Report report;
    }

    // ---------------------------------------------------------------- constantes y parámetros

    uint16 public constant MIN_VALID_BPS = 6000;
    uint16 public constant DEFAULT_THRESHOLD_BPS = 9500;
    uint16 private constant BPS = 10000;
    // Mitad del orden de secp256k1: firmas con s mayor son maleables y se rechazan.
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    address public immutable curator;
    uint8 public immutable quorum;
    uint64 public immutable challengeWindow;
    uint64 public immutable minInterval;
    uint64 public immutable maxObsAge;
    uint64 public immutable restorationTimeout;

    address[] public verifiers;
    mapping(address => uint8) public verifierIndex; // índice + 1; 0 = no es verificador

    // ---------------------------------------------------------------- estado

    uint256 public parcelCount;
    mapping(uint256 => Parcel) private _parcels;
    mapping(uint256 => Pending) private _pending;

    mapping(uint256 => mapping(address => uint256)) public refundStake;
    mapping(uint256 => mapping(address => uint256)) public restoreStake;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;
    mapping(uint256 => mapping(address => bool)) public restoreClaimed;
    mapping(uint256 => mapping(address => bool)) public leftoverClaimed;

    bool private _locked;

    // ---------------------------------------------------------------- certificados de monte en pie (ERC-1155)
    // 1 unidad = 1 hectárea-mes financiada. El id del token es el id de la parcela.
    // Cada cuota pagada suma hectáreas × (pagado / cuota) hectáreas-mes a la parcela, repartidas entre los
    // donantes en proporción a su aporte. Se lleva con un acumulador por parcela (sin recorrer donantes) y
    // cada donante acuña lo suyo con claimCertificates. No certifica carbono ni compensa emisiones.

    string public constant name = "Bosque en pie - certificado de monte en pie";
    string public constant symbol = "MONTE";
    uint256 private constant CERT_SCALE = 1e36;

    mapping(uint256 => uint256) public certPerStake;                       // hectáreas-mes por wei aportado × 1e36
    mapping(uint256 => mapping(address => uint256)) private _certDebt;     // lo ya contabilizado de cada donante
    mapping(uint256 => mapping(address => uint256)) private _certOwed;     // ganado y todavía sin acuñar
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => uint256) public certSupply;                         // en circulación (acuñado − retirado)
    mapping(uint256 => uint256) public certRetired;                        // retirado en total por parcela
    mapping(uint256 => mapping(address => uint256)) public certRetiredBy;  // retirado a nombre de cada cuenta

    // ---------------------------------------------------------------- eventos

    event ParcelRegistered(
        uint256 indexed parcelId, address owner, address operator, uint256 fee,
        uint16 thresholdBps, uint16 ownerShareBps, uint32 hectares, uint64 commitEnd
    );
    event Donated(uint256 indexed parcelId, address indexed donor, uint256 amount, Choice choice);
    event ReportSubmitted(uint256 indexed parcelId, Report report);
    event ReportChallenged(uint256 indexed parcelId, address indexed by);
    event ChallengeResolved(uint256 indexed parcelId, bool accepted);
    event ReportApplied(uint256 indexed parcelId, Report report, bool standing, Status status, uint256 paid);
    event Paid(uint256 indexed parcelId, address indexed owner, uint256 ownerAmount, address indexed operator, uint256 operatorAmount);
    event StatusChanged(uint256 indexed parcelId, Status status);
    event Withdrawn(uint256 indexed parcelId, address indexed donor, uint8 kind, uint256 amount); // 0 devolución, 1 restauración, 2 sobrante
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event CertificatesRetired(uint256 indexed parcelId, address indexed account, uint256 amount);

    // ---------------------------------------------------------------- modificadores

    modifier onlyCurator() {
        require(msg.sender == curator, "solo el curador");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "reentrada");
        _locked = true;
        _;
        _locked = false;
    }

    // ---------------------------------------------------------------- constructor

    constructor(
        address[] memory _verifiers,
        uint8 _quorum,
        uint64 _challengeWindow,
        uint64 _minInterval,
        uint64 _maxObsAge,
        uint64 _restorationTimeout
    ) {
        require(_verifiers.length > 0 && _verifiers.length <= 8, "entre 1 y 8 verificadores");
        require(_quorum > 0 && _quorum <= _verifiers.length, "quorum invalido");
        for (uint256 i = 0; i < _verifiers.length; i++) {
            address v = _verifiers[i];
            require(v != address(0), "verificador vacio");
            require(verifierIndex[v] == 0, "verificador repetido");
            verifiers.push(v);
            verifierIndex[v] = uint8(i + 1);
        }
        curator = msg.sender;
        quorum = _quorum;
        challengeWindow = _challengeWindow;
        minInterval = _minInterval;
        maxObsAge = _maxObsAge;
        restorationTimeout = _restorationTimeout;
    }

    // ---------------------------------------------------------------- curador

    /// @notice Registra una parcela. thresholdBps = 0 usa el umbral por defecto (9500).
    function registerParcel(
        address owner,
        address operator,
        uint256 fee,
        uint16 thresholdBps,
        uint16 ownerShareBps,
        uint32 hectares,
        uint64 commitEnd
    ) external onlyCurator returns (uint256 parcelId) {
        require(owner != address(0) && operator != address(0), "dueno u operador vacio");
        require(fee > 0, "cuota en cero");
        require(thresholdBps <= BPS && ownerShareBps <= BPS, "porcentaje fuera de rango");
        require(commitEnd == 0 || commitEnd > block.timestamp, "el compromiso ya termino");

        parcelId = ++parcelCount;
        Parcel storage p = _parcels[parcelId];
        p.owner = owner;
        p.operator = operator;
        p.fee = fee;
        p.thresholdBps = thresholdBps == 0 ? DEFAULT_THRESHOLD_BPS : thresholdBps;
        p.ownerShareBps = ownerShareBps;
        p.hectares = hectares;
        p.commitEnd = commitEnd;
        p.status = Status.Standing;

        emit ParcelRegistered(parcelId, owner, operator, fee, p.thresholdBps, ownerShareBps, hectares, commitEnd);
    }

    // ---------------------------------------------------------------- aportes

    /// @notice Aporta AVAX al pozo de una parcela y elige qué pasa con su parte si hay desmonte.
    function donate(uint256 parcelId, Choice choice) external payable {
        Parcel storage p = _parcels[parcelId];
        require(p.status == Status.Standing || p.status == Status.Review, "la parcela no recibe aportes");
        require(msg.value > 0, "aporte en cero");
        require(msg.sender != p.owner && msg.sender != p.operator, "quien cobra no puede aportar");

        _settleCert(parcelId, msg.sender);
        p.balance += msg.value;
        if (choice == Choice.Refund) {
            refundStake[parcelId][msg.sender] += msg.value;
            p.totalRefundStake += msg.value;
        } else {
            restoreStake[parcelId][msg.sender] += msg.value;
            p.totalRestoreStake += msg.value;
        }
        _certDebt[parcelId][msg.sender] = (_stakeOf(parcelId, msg.sender) * certPerStake[parcelId]) / CERT_SCALE;
        emit Donated(parcelId, msg.sender, msg.value, choice);
    }

    // ---------------------------------------------------------------- informes

    /// @notice Digest que firma cada verificador (con prefijo EIP-191 / personal_sign).
    function reportDigest(
        uint256 parcelId,
        uint64 tObs,
        uint16 coverBps,
        uint16 validBps,
        bytes32 evidenceHash
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), parcelId, tObs, coverBps, validBps, evidenceHash));
    }

    /// @notice Envía un informe firmado. Las firmas van ordenadas por dirección del firmante, de menor a mayor.
    function submitReport(
        uint256 parcelId,
        uint64 tObs,
        uint16 coverBps,
        uint16 validBps,
        bytes32 evidenceHash,
        bytes[] calldata signatures
    ) external nonReentrant {
        Parcel storage p = _parcels[parcelId];
        require(p.status == Status.Standing || p.status == Status.Review, "parcela no activa");
        require(!_pending[parcelId].active, "hay un informe pendiente");
        require(coverBps <= BPS && validBps <= BPS, "valores fuera de rango");
        require(validBps >= MIN_VALID_BPS, "parte visible insuficiente");
        require(tObs > 0 && tObs <= block.timestamp, "fecha de imagen futura o vacia");
        if (maxObsAge > 0) require(block.timestamp - tObs <= maxObsAge, "imagen demasiado vieja");
        if (p.lastObs != 0) require(tObs >= p.lastObs + minInterval, "imagen muy cercana a la anterior");

        bytes32 digest = reportDigest(parcelId, tObs, coverBps, validBps, evidenceHash);
        Report memory r = Report(tObs, coverBps, validBps, evidenceHash, _checkSignatures(digest, signatures));
        emit ReportSubmitted(parcelId, r);

        if (challengeWindow == 0) {
            _apply(parcelId, r);
        } else {
            _pending[parcelId] = Pending(true, false, uint64(block.timestamp), r);
        }
    }

    /// @notice Impugna el informe pendiente. Pueden hacerlo el dueño, el operador o un donante de la parcela.
    function challenge(uint256 parcelId) external {
        Pending storage pr = _pending[parcelId];
        require(pr.active, "no hay informe pendiente");
        require(!pr.challenged, "ya fue impugnado");
        require(block.timestamp < pr.submittedAt + challengeWindow, "ventana de impugnacion cerrada");
        Parcel storage p = _parcels[parcelId];
        require(
            msg.sender == p.owner || msg.sender == p.operator ||
                refundStake[parcelId][msg.sender] + restoreStake[parcelId][msg.sender] > 0,
            "no puede impugnar este informe"
        );
        pr.challenged = true;
        emit ReportChallenged(parcelId, msg.sender);
    }

    /// @notice Ejecuta un informe pendiente que no fue impugnado, pasada la ventana.
    function executeReport(uint256 parcelId) external nonReentrant {
        Pending memory pr = _pending[parcelId];
        require(pr.active, "no hay informe pendiente");
        require(!pr.challenged, "informe impugnado: decide el curador");
        require(block.timestamp >= pr.submittedAt + challengeWindow, "la ventana sigue abierta");
        delete _pending[parcelId];
        _apply(parcelId, pr.report);
    }

    /// @notice El curador resuelve una impugnación: acepta (se aplica) o rechaza (se descarta) el informe.
    function resolveChallenge(uint256 parcelId, bool accept) external onlyCurator nonReentrant {
        Pending memory pr = _pending[parcelId];
        require(pr.active && pr.challenged, "no hay impugnacion pendiente");
        delete _pending[parcelId];
        emit ChallengeResolved(parcelId, accept);
        if (accept) _apply(parcelId, pr.report);
    }

    // ---------------------------------------------------------------- compromiso (regla 9)

    /// @notice Cierra el compromiso de una parcela en pie cuando pasó commitEnd. Terminan los pagos.
    function closeCommitment(uint256 parcelId) external {
        Parcel storage p = _parcels[parcelId];
        require(p.commitEnd != 0 && block.timestamp >= p.commitEnd, "el compromiso no termino");
        require(p.status == Status.Standing, "solo se cierra una parcela en pie");
        require(!_pending[parcelId].active, "hay un informe pendiente");
        p.status = Status.Closed;
        p.leftoverPool = p.balance;
        p.balance = 0;
        p.endedAt = uint64(block.timestamp);
        emit StatusChanged(parcelId, Status.Closed);
    }

    // ---------------------------------------------------------------- retiros

    /// @notice Tras el desmonte, retira la parte "devolución" que te corresponde.
    function withdrawRefund(uint256 parcelId) external nonReentrant {
        Parcel storage p = _parcels[parcelId];
        require(p.status == Status.Cleared, "la parcela no esta desmontada");
        uint256 stake = refundStake[parcelId][msg.sender];
        require(stake > 0, "no tiene devolucion en esta parcela");
        require(!refundClaimed[parcelId][msg.sender], "ya retiro");
        refundClaimed[parcelId][msg.sender] = true;
        uint256 amount = (p.refundPool * stake) / p.totalRefundStake;
        emit Withdrawn(parcelId, msg.sender, 0, amount);
        _send(msg.sender, amount);
    }

    /// @notice Pasado restorationTimeout sin usarse, retira la parte "restauración" que te corresponde.
    function withdrawRestoration(uint256 parcelId) external nonReentrant {
        Parcel storage p = _parcels[parcelId];
        require(p.status == Status.Cleared, "la parcela no esta desmontada");
        require(block.timestamp >= p.endedAt + restorationTimeout, "el fondo de restauracion sigue bloqueado");
        uint256 stake = restoreStake[parcelId][msg.sender];
        require(stake > 0, "no tiene restauracion en esta parcela");
        require(!restoreClaimed[parcelId][msg.sender], "ya retiro");
        restoreClaimed[parcelId][msg.sender] = true;
        uint256 amount = (p.restorePool * stake) / p.totalRestoreStake;
        emit Withdrawn(parcelId, msg.sender, 1, amount);
        _send(msg.sender, amount);
    }

    /// @notice Cerrado el compromiso con el monte en pie, retira el saldo sobrante en proporción a tu aporte.
    function withdrawLeftover(uint256 parcelId) external nonReentrant {
        Parcel storage p = _parcels[parcelId];
        require(p.status == Status.Closed, "el compromiso no esta cerrado");
        uint256 stake = refundStake[parcelId][msg.sender] + restoreStake[parcelId][msg.sender];
        require(stake > 0, "no aporto a esta parcela");
        require(!leftoverClaimed[parcelId][msg.sender], "ya retiro");
        leftoverClaimed[parcelId][msg.sender] = true;
        uint256 amount = (p.leftoverPool * stake) / (p.totalRefundStake + p.totalRestoreStake);
        emit Withdrawn(parcelId, msg.sender, 2, amount);
        _send(msg.sender, amount);
    }

    // ---------------------------------------------------------------- certificados

    /// @notice Hectáreas-mes ganadas y todavía sin acuñar.
    function pendingCertificates(uint256 parcelId, address account) public view returns (uint256) {
        uint256 accrued = (_stakeOf(parcelId, account) * certPerStake[parcelId]) / CERT_SCALE;
        return _certOwed[parcelId][account] + accrued - _certDebt[parcelId][account];
    }

    /// @notice Acuña a tu nombre los certificados ganados en una parcela.
    function claimCertificates(uint256 parcelId) external nonReentrant returns (uint256 amount) {
        _settleCert(parcelId, msg.sender);
        amount = _certOwed[parcelId][msg.sender];
        require(amount > 0, "no hay certificados para acunar");
        _certOwed[parcelId][msg.sender] = 0;
        _balances[parcelId][msg.sender] += amount;
        certSupply[parcelId] += amount;
        emit TransferSingle(msg.sender, address(0), msg.sender, parcelId, amount);
        _checkReceiver(msg.sender, address(0), msg.sender, parcelId, amount, "");
    }

    /// @notice Retira certificados: se queman y quedan registrados a tu nombre (regla 9: solo pasado
    ///         commitEnd y si la parcela no fue desmontada; con commitEnd = 0 no hay plazo).
    function retireCertificates(uint256 parcelId, uint256 amount) external {
        Parcel storage p = _parcels[parcelId];
        require(p.status != Status.Cleared, "certificados congelados por desmonte");
        require(p.commitEnd == 0 || block.timestamp >= p.commitEnd, "bloqueados hasta el fin del compromiso");
        require(amount > 0, "cantidad en cero");
        require(_balances[parcelId][msg.sender] >= amount, "saldo de certificados insuficiente");
        _balances[parcelId][msg.sender] -= amount;
        certSupply[parcelId] -= amount;
        certRetired[parcelId] += amount;
        certRetiredBy[parcelId][msg.sender] += amount;
        emit TransferSingle(msg.sender, msg.sender, address(0), parcelId, amount);
        emit CertificatesRetired(parcelId, msg.sender, amount);
    }

    // ERC-1155 mínimo

    function balanceOf(address account, uint256 id) public view returns (uint256) {
        require(account != address(0), "cuenta vacia");
        return _balances[id][account];
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory out) {
        require(accounts.length == ids.length, "largos distintos");
        out = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) out[i] = balanceOf(accounts[i], ids[i]);
    }

    function setApprovalForAll(address operator, bool approved) external {
        require(operator != msg.sender, "no podes aprobarte a vos");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external {
        require(from == msg.sender || isApprovedForAll(from, msg.sender), "sin permiso para transferir");
        _moveCert(from, to, id, value);
        emit TransferSingle(msg.sender, from, to, id, value);
        _checkReceiver(msg.sender, from, to, id, value, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external {
        require(from == msg.sender || isApprovedForAll(from, msg.sender), "sin permiso para transferir");
        require(ids.length == values.length, "largos distintos");
        for (uint256 i = 0; i < ids.length; i++) _moveCert(from, to, ids[i], values[i]);
        emit TransferBatch(msg.sender, from, to, ids, values);
        if (to.code.length > 0) {
            require(
                IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, values, data) ==
                    IERC1155Receiver.onERC1155BatchReceived.selector,
                "el destino no acepta certificados"
            );
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0xd9b67a26; // ERC-165 y ERC-1155
    }

    // ---------------------------------------------------------------- lectura

    function getParcel(uint256 parcelId) external view returns (Parcel memory) {
        return _parcels[parcelId];
    }

    function getPending(uint256 parcelId) external view returns (Pending memory) {
        return _pending[parcelId];
    }

    function verifierCount() external view returns (uint256) {
        return verifiers.length;
    }

    // ---------------------------------------------------------------- internas

    function _apply(uint256 parcelId, Report memory r) private {
        Parcel storage p = _parcels[parcelId];
        p.lastObs = r.tObs;
        bool standing = r.coverBps >= p.thresholdBps;
        uint256 paid;

        if (standing) {
            if (p.status == Status.Review) {
                p.status = Status.Standing; // regla 5: vuelve a en pie y paga
                emit StatusChanged(parcelId, Status.Standing);
            }
            paid = _pay(parcelId, p);
        } else if (p.status == Status.Standing) {
            p.status = Status.Review; // regla 3: no paga, no corta
            emit StatusChanged(parcelId, Status.Review);
        } else {
            _clear(parcelId, p); // regla 4: segunda lectura mala seguida
        }
        emit ReportApplied(parcelId, r, standing, p.status, paid);
    }

    function _pay(uint256 parcelId, Parcel storage p) private returns (uint256 amount) {
        amount = p.fee < p.balance ? p.fee : p.balance; // regla 2: si no alcanza, paga lo que queda
        if (amount == 0) return 0;
        p.balance -= amount;
        uint256 stakes = p.totalRefundStake + p.totalRestoreStake;
        if (stakes > 0) {
            // Redondeo hacia arriba: con truncado, 12 cuotas de 100 ha daban 1199 en vez de 1200 a un donante
            // único. El exceso por donante es < aporte × cuotas / 1e36 unidades (despreciable).
            uint256 den = p.fee * stakes;
            certPerStake[parcelId] += (uint256(p.hectares) * amount * CERT_SCALE + den - 1) / den;
        }
        uint256 ownerAmount = (amount * p.ownerShareBps) / BPS;
        uint256 operatorAmount = amount - ownerAmount;
        emit Paid(parcelId, p.owner, ownerAmount, p.operator, operatorAmount);
        _send(p.owner, ownerAmount);
        _send(p.operator, operatorAmount);
    }

    function _clear(uint256 parcelId, Parcel storage p) private {
        p.status = Status.Cleared;
        p.endedAt = uint64(block.timestamp);
        uint256 total = p.totalRefundStake + p.totalRestoreStake;
        if (total > 0) {
            p.refundPool = (p.balance * p.totalRefundStake) / total;
            p.restorePool = p.balance - p.refundPool;
        }
        p.balance = 0; // regla 8: nada va al dueño ni al operador
        emit StatusChanged(parcelId, Status.Cleared);
    }

    function _checkSignatures(bytes32 digest, bytes[] calldata signatures) private view returns (uint8 mask) {
        require(signatures.length >= quorum, "faltan firmas");
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address last = address(0);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = _recover(ethHash, signatures[i]);
            require(signer > last, "firmas repetidas o desordenadas");
            uint8 idx = verifierIndex[signer];
            require(idx != 0, "firmante no registrado");
            mask |= uint8(1 << (idx - 1));
            last = signer;
        }
    }

    function _recover(bytes32 hash, bytes calldata sig) private pure returns (address signer) {
        require(sig.length == 65, "firma mal formada");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "firma mal formada");
        require(uint256(s) <= HALF_N, "firma maleable");
        signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "firma invalida");
    }

    function _stakeOf(uint256 parcelId, address account) private view returns (uint256) {
        return refundStake[parcelId][account] + restoreStake[parcelId][account];
    }

    function _settleCert(uint256 parcelId, address account) private {
        uint256 accrued = (_stakeOf(parcelId, account) * certPerStake[parcelId]) / CERT_SCALE;
        _certOwed[parcelId][account] += accrued - _certDebt[parcelId][account];
        _certDebt[parcelId][account] = accrued;
    }

    function _moveCert(address from, address to, uint256 id, uint256 value) private {
        require(to != address(0), "destino vacio");
        require(_parcels[id].status != Status.Cleared, "certificados congelados por desmonte");
        require(_balances[id][from] >= value, "saldo de certificados insuficiente");
        _balances[id][from] -= value;
        _balances[id][to] += value;
    }

    function _checkReceiver(address operator, address from, address to, uint256 id, uint256 value, bytes memory data) private {
        if (to.code.length == 0) return;
        require(
            IERC1155Receiver(to).onERC1155Received(operator, from, id, value, data) ==
                IERC1155Receiver.onERC1155Received.selector,
            "el destino no acepta certificados"
        );
    }

    function _send(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "no se pudo transferir");
    }
}
