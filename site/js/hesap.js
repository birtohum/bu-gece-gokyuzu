// Arka planda (Web Worker) çalışır: bu gecenin görünür geçişlerini hesaplar, sayfaya döndürür.
import * as sat from "./satellite.es.js";
import { karanlikDilimler, gecisleriBul, gozlemci, satrecYap } from "./gecis.js";

const ONE_CIKAN = [25544, 48274]; // ISS, Tiangong: bu gece yoksa sonraki görünür geçişi de ararız
let uydular = null;

function sade(g, u) {
  return {
    norad: u.norad, ad: u.ad, kod: u.kod, epoch: u.epoch,
    bas: g.bas, tepe: g.tepe, son: g.son, sureSn: g.sureSn,
    golgeyeGirer: g.golgeyeGirer, yol: g.yol, yay: g.yay,
  };
}

self.onmessage = (e) => {
  const { tur } = e.data;
  if (tur === "veri") {
    uydular = e.data.uydular.map((u) => ({ ...u, satrec: satrecYap(sat, u) }));
    return;
  }
  if (tur !== "hesapla") return;
  const { enlem, boylam, simdi, kimlik } = e.data;
  const gz = gozlemci(enlem, boylam, 0);
  // İçinde bulunduğumuz ya da sıradaki karanlık dilim = "bu gece".
  const dilimler = karanlikDilimler(sat, gz, simdi - 3600e3, simdi + 36 * 3600e3);
  const gece = dilimler.find(([, b]) => b > simdi) || dilimler[0];
  const liste = [];
  for (const u of uydular) {
    for (const g of gecisleriBul(sat, u.satrec, gz, [gece])) {
      if (g.son.ms < simdi) continue;
      liste.push(sade(g, u));
    }
  }
  liste.sort((a, b) => a.bas.ms - b.bas.ms);
  // Bu gece görünmeyen öne çıkan istasyonlar için önümüzdeki 10 gecede ilk görünür geçiş.
  const sonraki = {};
  const ileri = karanlikDilimler(sat, gz, gece[1], gece[1] + 10 * 86400e3);
  for (const n of ONE_CIKAN) {
    if (liste.some((g) => g.norad === n)) continue;
    const u = uydular.find((x) => x.norad === n);
    if (!u) continue;
    for (const d of ileri) {
      const g = gecisleriBul(sat, u.satrec, gz, [d])[0];
      if (g) { sonraki[n] = sade(g, u); break; }
    }
  }
  self.postMessage({ kimlik, gece, liste, sonraki });
};
