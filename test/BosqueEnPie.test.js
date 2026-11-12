const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const DAY = 24 * 60 * 60;
const E = (x) => ethers.parseEther(String(x));
const EVIDENCE = ethers.keccak256(ethers.toUtf8Bytes('{"algoritmo":"bosque-v1"}'));
const Status = { None: 0n, Standing: 1n, Review: 2n, Cleared: 3n, Closed: 4n };
const Choice = { Refund: 0, Restoration: 1 };

// Firma como lo hará Python: personal_sign sobre los 32 bytes del digest.
async function sign(c, signers, parcelId, tObs, cover, valid, evidence = EVIDENCE) {
  const digest = await c.reportDigest(parcelId, tObs, cover, valid, evidence);
  const sorted = [...signers].sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1));
  return Promise.all(sorted.map((s) => s.signMessage(ethers.getBytes(digest))));
}

// Avanza el reloj y devuelve una fecha de imagen válida (ahora).
async function nextObs(days = 30) {
  await time.increase(days * DAY);
  return BigInt(await time.latest());
}

async function deploy(opts = {}) {
  const s = await ethers.getSigners();
  const [curator, v1, v2, v3, ownerA, opA, ownerB, opB, d1, d2, d3, outsider] = s;
  const F = await ethers.getContractFactory("BosqueEnPie");
  const c = await F.connect(curator).deploy(
    [v1.address, v2.address, v3.address],
    opts.quorum ?? 2,
    opts.challengeWindow ?? 0,
    opts.minInterval ?? 20 * DAY,
    opts.maxObsAge ?? 0,
    opts.restorationTimeout ?? 365 * DAY
  );
  return { c, curator, v1, v2, v3, ownerA, opA, ownerB, opB, d1, d2, d3, outsider };
}

async function baseFixture() {
  const f = await deploy();
  // Parcela 1: cuota 0,1 AVAX, 60 % al dueño, umbral por defecto, sin plazo.
  await f.c.registerParcel(f.ownerA.address, f.opA.address, E("0.1"), 0, 6000, 214, 0);
  return f;
}

async function report(f, parcelId, cover, opts = {}) {
  const tObs = opts.tObs ?? (await nextObs(opts.days ?? 30));
  const valid = opts.valid ?? 9000;
  const sigs = opts.sigs ?? (await sign(f.c, opts.signers ?? [f.v1, f.v2], parcelId, tObs, cover, valid));
  return f.c.submitReport(parcelId, tObs, cover, valid, EVIDENCE, sigs);
}

describe("BosqueEnPie", function () {
  describe("despliegue y registro", function () {
    it("rechaza quórum mayor que la cantidad de verificadores", async function () {
      const [, v1, v2] = await ethers.getSigners();
      const F = await ethers.getContractFactory("BosqueEnPie");
      await expect(F.deploy([v1.address, v2.address], 3, 0, 0, 0, 0)).to.be.revertedWith("quorum invalido");
    });

    it("rechaza verificadores repetidos", async function () {
      const [, v1] = await ethers.getSigners();
      const F = await ethers.getContractFactory("BosqueEnPie");
      await expect(F.deploy([v1.address, v1.address], 1, 0, 0, 0, 0)).to.be.revertedWith("verificador repetido");
    });

    it("solo el curador registra parcelas y el umbral por defecto es 9500", async function () {
      const f = await loadFixture(baseFixture);
      await expect(
        f.c.connect(f.outsider).registerParcel(f.ownerB.address, f.opB.address, E("0.1"), 0, 5000, 100, 0)
      ).to.be.revertedWith("solo el curador");
      const p = await f.c.getParcel(1);
      expect(p.thresholdBps).to.equal(9500);
      expect(p.status).to.equal(Status.Standing);
    });
  });

  describe("aportes", function () {
    it("guarda el aporte y la elección de cada donante", async function () {
      const f = await loadFixture(baseFixture);
      await expect(f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) }))
        .to.emit(f.c, "Donated").withArgs(1, f.d1.address, E(1), Choice.Refund);
      await f.c.connect(f.d2).donate(1, Choice.Restoration, { value: E(2) });
      const p = await f.c.getParcel(1);
      expect(p.balance).to.equal(E(3));
      expect(p.totalRefundStake).to.equal(E(1));
      expect(p.totalRestoreStake).to.equal(E(2));
      expect(await f.c.restoreStake(1, f.d2.address)).to.equal(E(2));
    });

    it("rechaza aportes en cero y aportes del dueño o del operador (regla 10)", async function () {
      const f = await loadFixture(baseFixture);
      await expect(f.c.connect(f.d1).donate(1, Choice.Refund, { value: 0 })).to.be.revertedWith("aporte en cero");
      await expect(f.c.connect(f.ownerA).donate(1, Choice.Refund, { value: E(1) })).to.be.revertedWith("quien cobra no puede aportar");
      await expect(f.c.connect(f.opA).donate(1, Choice.Refund, { value: E(1) })).to.be.revertedWith("quien cobra no puede aportar");
    });
  });

  describe("firmas e informes (regla 1)", function () {
    it("acepta 2 de 3 firmas y paga la cuota repartida entre dueño y operador", async function () {
      const f = await loadFixture(baseFixture);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) });
      await expect(report(f, 1, 9900)).to.changeEtherBalances([f.ownerA, f.opA, f.c], [E("0.06"), E("0.04"), E("-0.1")]);
    });

    it("informa qué verificadores firmaron", async function () {
      const f = await loadFixture(baseFixture);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) });
      const tx = await report(f, 1, 9900, { signers: [f.v1, f.v3] });
      const rc = await tx.wait();
      const ev = rc.logs.map((l) => f.c.interface.parseLog(l)).find((e) => e && e.name === "ReportApplied");
      expect(ev.args.report.signersMask).to.equal(0b101);
    });

    it("rechaza un informe con una sola firma (quórum)", async function () {
      const f = await loadFixture(baseFixture);
      await expect(report(f, 1, 9900, { signers: [f.v1] })).to.be.revertedWith("faltan firmas");
    });

    it("rechaza firmas repetidas", async function () {
      const f = await loadFixture(baseFixture);
      const tObs = await nextObs();
      const [s1] = await sign(f.c, [f.v1], 1, tObs, 9900, 9000);
      await expect(f.c.submitReport(1, tObs, 9900, 9000, EVIDENCE, [s1, s1])).to.be.revertedWith("firmas repetidas o desordenadas");
    });

    it("rechaza firmas desordenadas", async function () {
      const f = await loadFixture(baseFixture);
      const tObs = await nextObs();
      const sigs = await sign(f.c, [f.v1, f.v2], 1, tObs, 9900, 9000);
      await expect(f.c.submitReport(1, tObs, 9900, 9000, EVIDENCE, [sigs[1], sigs[0]])).to.be.revertedWith(
        "firmas repetidas o desordenadas"
      );
    });

    it("rechaza firmantes que no son verificadores", async function () {
      const f = await loadFixture(baseFixture);
      await expect(report(f, 1, 9900, { signers: [f.v1, f.outsider] })).to.be.reverted;
      const tObs = await nextObs();
      const sigs = await sign(f.c, [f.outsider, f.d1], 1, tObs, 9900, 9000);
      await expect(f.c.submitReport(1, tObs, 9900, 9000, EVIDENCE, sigs)).to.be.revertedWith("firmante no registrado");
    });

    it("rechaza un informe alterado después de firmar", async function () {
      const f = await loadFixture(baseFixture);
      const tObs = await nextObs();
      const sigs = await sign(f.c, [f.v1, f.v2], 1, tObs, 4000, 9000); // firmaron 40 %
      await expect(f.c.submitReport(1, tObs, 9900, 9000, EVIDENCE, sigs)).to.be.reverted; // envían 99 %
      const otherEvidence = ethers.keccak256(ethers.toUtf8Bytes("otra evidencia"));
      await expect(f.c.submitReport(1, tObs, 4000, 9000, otherEvidence, sigs)).to.be.reverted;
    });

    it("rechaza firmas hechas para otra parcela", async function () {
      const f = await loadFixture(baseFixture);
      await f.c.registerParcel(f.ownerB.address, f.opB.address, E("0.1"), 0, 6000, 187, 0);
      const tObs = await nextObs();
      const sigs = await sign(f.c, [f.v1, f.v2], 2, tObs, 9900, 9000);
      await expect(f.c.submitReport(1, tObs, 9900, 9000, EVIDENCE, sigs)).to.be.reverted;
    });

    it("rechaza imágenes con nubes (parte visible < 60 %)", async function () {
      const f = await loadFixture(baseFixture);
      await expect(report(f, 1, 9900, { valid: 5999 })).to.be.revertedWith("parte visible insuficiente");
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) });
      await expect(report(f, 1, 9900, { valid: 6000 })).to.emit(f.c, "Paid");
    });

    it("rechaza fechas futuras y fechas muy cercanas a la anterior", async function () {
      const f = await loadFixture(baseFixture);
      const now = BigInt(await time.latest());
      const future = now + 3600n;
      const sigs = await sign(f.c, [f.v1, f.v2], 1, future, 9900, 9000);
      await expect(f.c.submitReport(1, future, 9900, 9000, EVIDENCE, sigs)).to.be.revertedWith(
        "fecha de imagen futura o vacia"
      );
      const t1 = await nextObs();
      await report(f, 1, 9900, { tObs: t1 });
      await time.increase(30 * DAY);
      await expect(report(f, 1, 9900, { tObs: t1 + 19n * BigInt(DAY) })).to.be.revertedWith(
        "imagen muy cercana a la anterior"
      );
      await expect(report(f, 1, 9900, { tObs: t1 + 20n * BigInt(DAY) })).to.emit(f.c, "ReportApplied");
    });

    it("rechaza imágenes más viejas que maxObsAge", async function () {
      const f = await deploy({ maxObsAge: 45 * DAY });
      await f.c.registerParcel(f.ownerA.address, f.opA.address, E("0.1"), 0, 6000, 214, 0);
      const tObs = await nextObs();
      await time.increase(46 * DAY);
      await expect(report(f, 1, 9900, { tObs })).to.be.revertedWith("imagen demasiado vieja");
    });
  });

  describe("revisión, corte y pozo (reglas 2 a 5)", function () {
    it("primera lectura mala: en revisión, no paga; lectura buena: vuelve a en pie y paga", async function () {
      const f = await loadFixture(baseFixture);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) });
      await expect(report(f, 1, 7130)).to.changeEtherBalances([f.ownerA, f.opA], [0, 0]);
      expect((await f.c.getParcel(1)).status).to.equal(Status.Review);
      await expect(report(f, 1, 9800)).to.changeEtherBalances([f.ownerA, f.opA], [E("0.06"), E("0.04")]);
      expect((await f.c.getParcel(1)).status).to.equal(Status.Standing);
    });

    it("segunda lectura mala seguida: desmontada para siempre", async function () {
      const f = await loadFixture(baseFixture);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) });
      await report(f, 1, 7130);
      await expect(report(f, 1, 3860)).to.emit(f.c, "StatusChanged").withArgs(1, Status.Cleared);
      await expect(report(f, 1, 9900)).to.be.revertedWith("parcela no activa");
      await expect(f.c.connect(f.d2).donate(1, Choice.Refund, { value: E(1) })).to.be.revertedWith(
        "la parcela no recibe aportes"
      );
    });

    it("si el pozo no alcanza, paga lo que queda", async function () {
      const f = await loadFixture(baseFixture);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E("0.15") });
      await report(f, 1, 9900);
      await expect(report(f, 1, 9900)).to.changeEtherBalances([f.ownerA, f.opA], [E("0.03"), E("0.02")]);
      await expect(report(f, 1, 9900)).to.changeEtherBalances([f.ownerA, f.opA], [0, 0]); // pozo vacío, no falla
    });
  });

  describe("división del saldo al desmonte (reglas 6 y 8)", function () {
    async function clearedFixture() {
      const f = await baseFixture();
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(3) });
      await f.c.connect(f.d2).donate(1, Choice.Restoration, { value: E(1) });
      await f.c.connect(f.d3).donate(1, Choice.Refund, { value: E(1) });
      await report(f, 1, 9900); // paga 0,1 → quedan 4,9
      await report(f, 1, 7000);
      await report(f, 1, 3000); // corte
      return f;
    }

    it("reparte devolución y restauración en proporción a lo aportado", async function () {
      const f = await loadFixture(clearedFixture);
      const p = await f.c.getParcel(1);
      expect(p.refundPool).to.equal((E("4.9") * E(4)) / E(5)); // 4/5 del saldo eligió devolución
      expect(p.restorePool).to.equal(E("4.9") - p.refundPool);
      await expect(f.c.connect(f.d1).withdrawRefund(1)).to.changeEtherBalance(f.d1, (p.refundPool * 3n) / 4n);
      await expect(f.c.connect(f.d3).withdrawRefund(1)).to.changeEtherBalance(f.d3, p.refundPool / 4n);
    });

    it("no permite retirar dos veces ni retirar sin aporte", async function () {
      const f = await loadFixture(clearedFixture);
      await f.c.connect(f.d1).withdrawRefund(1);
      await expect(f.c.connect(f.d1).withdrawRefund(1)).to.be.revertedWith("ya retiro");
      await expect(f.c.connect(f.d2).withdrawRefund(1)).to.be.revertedWith("no tiene devolucion en esta parcela");
      await expect(f.c.connect(f.ownerA).withdrawRefund(1)).to.be.revertedWith("no tiene devolucion en esta parcela");
    });

    it("el fondo de restauración queda bloqueado hasta restorationTimeout", async function () {
      const f = await loadFixture(clearedFixture);
      await expect(f.c.connect(f.d2).withdrawRestoration(1)).to.be.revertedWith("el fondo de restauracion sigue bloqueado");
      await time.increase(365 * DAY);
      const p = await f.c.getParcel(1);
      await expect(f.c.connect(f.d2).withdrawRestoration(1)).to.changeEtherBalance(f.d2, p.restorePool);
    });

    it("no se puede retirar devolución si la parcela sigue en pie", async function () {
      const f = await loadFixture(baseFixture);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) });
      await expect(f.c.connect(f.d1).withdrawRefund(1)).to.be.revertedWith("la parcela no esta desmontada");
    });
  });

  describe("impugnación (regla 7)", function () {
    async function challengeFixture() {
      const f = await deploy({ challengeWindow: 72 * 3600 });
      await f.c.registerParcel(f.ownerA.address, f.opA.address, E("0.1"), 0, 6000, 214, 0);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(1) });
      return f;
    }

    it("deja el informe pendiente y no acepta otro mientras tanto", async function () {
      const f = await loadFixture(challengeFixture);
      await expect(report(f, 1, 9900)).to.not.emit(f.c, "Paid");
      expect((await f.c.getPending(1)).active).to.equal(true);
      await expect(report(f, 1, 9900)).to.be.revertedWith("hay un informe pendiente");
    });

    it("sin impugnación, se ejecuta al terminar la ventana", async function () {
      const f = await loadFixture(challengeFixture);
      await report(f, 1, 9900);
      await expect(f.c.executeReport(1)).to.be.revertedWith("la ventana sigue abierta");
      await time.increase(72 * 3600);
      await expect(f.c.executeReport(1)).to.changeEtherBalances([f.ownerA, f.opA], [E("0.06"), E("0.04")]);
    });

    it("solo el dueño, el operador o un donante pueden impugnar", async function () {
      const f = await loadFixture(challengeFixture);
      await report(f, 1, 9900);
      await expect(f.c.connect(f.outsider).challenge(1)).to.be.revertedWith("no puede impugnar este informe");
      await expect(f.c.connect(f.d1).challenge(1)).to.emit(f.c, "ReportChallenged").withArgs(1, f.d1.address);
      await time.increase(72 * 3600);
      await expect(f.c.executeReport(1)).to.be.revertedWith("informe impugnado: decide el curador");
    });

    it("el curador rechaza: se descarta y la fecha anterior no cambia", async function () {
      const f = await loadFixture(challengeFixture);
      await report(f, 1, 3000);
      await f.c.connect(f.ownerA).challenge(1);
      await expect(f.c.connect(f.d1).resolveChallenge(1, false)).to.be.revertedWith("solo el curador");
      await f.c.resolveChallenge(1, false);
      const p = await f.c.getParcel(1);
      expect(p.status).to.equal(Status.Standing);
      expect(p.lastObs).to.equal(0);
    });

    it("el curador acepta: se aplica el informe", async function () {
      const f = await loadFixture(challengeFixture);
      await report(f, 1, 9900);
      await f.c.connect(f.opA).challenge(1);
      await expect(f.c.resolveChallenge(1, true)).to.changeEtherBalances([f.ownerA, f.opA], [E("0.06"), E("0.04")]);
    });

    it("no se puede impugnar después de la ventana", async function () {
      const f = await loadFixture(challengeFixture);
      await report(f, 1, 9900);
      await time.increase(72 * 3600);
      await expect(f.c.connect(f.d1).challenge(1)).to.be.revertedWith("ventana de impugnacion cerrada");
    });
  });

  describe("compromiso con plazo (regla 9)", function () {
    async function commitFixture() {
      const f = await deploy();
      const end = BigInt(await time.latest()) + 400n * BigInt(DAY);
      await f.c.registerParcel(f.ownerA.address, f.opA.address, E("0.1"), 0, 6000, 214, end);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E(3) });
      await f.c.connect(f.d2).donate(1, Choice.Restoration, { value: E(1) });
      return { ...f, end };
    }

    it("no se cierra antes de commitEnd", async function () {
      const f = await loadFixture(commitFixture);
      await expect(f.c.closeCommitment(1)).to.be.revertedWith("el compromiso no termino");
    });

    it("cerrado con el monte en pie, cada donante retira el sobrante en proporción", async function () {
      const f = await loadFixture(commitFixture);
      await report(f, 1, 9900);
      await report(f, 1, 9900); // pagó 0,2 → quedan 3,8
      await time.increaseTo(f.end);
      await expect(f.c.closeCommitment(1)).to.emit(f.c, "StatusChanged").withArgs(1, Status.Closed);
      await expect(f.c.connect(f.d1).withdrawLeftover(1)).to.changeEtherBalance(f.d1, (E("3.8") * 3n) / 4n);
      await expect(f.c.connect(f.d2).withdrawLeftover(1)).to.changeEtherBalance(f.d2, E("3.8") / 4n);
      await expect(f.c.connect(f.d2).withdrawLeftover(1)).to.be.revertedWith("ya retiro");
      await expect(report(f, 1, 9900)).to.be.revertedWith("parcela no activa");
    });

    it("una parcela en revisión no se puede cerrar para esquivar el corte", async function () {
      const f = await loadFixture(commitFixture);
      await report(f, 1, 7000);
      await time.increaseTo(f.end);
      await expect(f.c.closeCommitment(1)).to.be.revertedWith("solo se cierra una parcela en pie");
    });

    it("sin plazo (commitEnd = 0) nunca se cierra", async function () {
      const f = await loadFixture(baseFixture);
      await time.increase(1000 * DAY);
      await expect(f.c.closeCommitment(1)).to.be.revertedWith("el compromiso no termino");
    });
  });

  describe("ciclo completo de la parcela B", function () {
    it("6 cuotas, revisión, corte y todos los retiros: el dueño y el operador cobran solo las 6 cuotas", async function () {
      const f = await deploy();
      await f.c.registerParcel(f.ownerB.address, f.opB.address, E("0.1"), 0, 6000, 187, 0);
      await f.c.connect(f.d1).donate(1, Choice.Refund, { value: E("1.2") });
      await f.c.connect(f.d2).donate(1, Choice.Refund, { value: E(1) });
      await f.c.connect(f.d3).donate(1, Choice.Restoration, { value: E(2) });

      const ownerBefore = await ethers.provider.getBalance(f.ownerB.address);
      const opBefore = await ethers.provider.getBalance(f.opB.address);
      for (let m = 0; m < 6; m++) await report(f, 1, 9800);
      await report(f, 1, 7130); // julio: revisión
      await report(f, 1, 3860); // agosto: corte
      expect(await ethers.provider.getBalance(f.ownerB.address)).to.equal(ownerBefore + E("0.36"));
      expect(await ethers.provider.getBalance(f.opB.address)).to.equal(opBefore + E("0.24"));

      await f.c.connect(f.d1).withdrawRefund(1);
      await f.c.connect(f.d2).withdrawRefund(1);
      await time.increase(365 * DAY);
      await f.c.connect(f.d3).withdrawRestoration(1);
      const left = await ethers.provider.getBalance(await f.c.getAddress());
      expect(left).to.be.lessThan(3n); // a lo sumo restos de redondeo en wei
    });
  });
});
