// Tarayıcı hesabını (site/js/gecis.js + satellite.js) bağımsız skyfield referansıyla karşılaştırır.
// Referans: `python dogrula.py` → testler/referans.json (aynı sabit TLE dosyası, 4 şehir, 3 gün).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  tumGecisler, gunesYuksekligi, gozlemci, gunesteMi, yon, yukseklikSozu,
} from "../site/js/gecis.js";
import { ILLER } from "../site/js/iller.js";

const sat = createRequire(import.meta.url)("satellite.js");
const oku = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const ref = oku("./referans.json");
const veri = oku("./uydular_sabit.json");

function karsilastir() {
  const norads = new Set(ref.gecisler.map((g) => g.norad));
  const uydular = veri.uydular.filter((u) => norads.has(u.norad));
  const sehirler = [...new Map(ref.gecisler.map((g) => [g.sehir, [g.enlem, g.boylam]])).entries()];
  const son = ref.bas + ref.gun * 86400e3;
  const eslesen = [], kacan = [], fazla = [];
  for (const [sehir, [enl, boy]] of sehirler) {
    const { liste } = tumGecisler(sat, uydular, enl, boy, ref.bas, son);
    const r = ref.gecisler.filter((g) => g.sehir === sehir);
    const kullanildi = new Set();
    for (const g of r) {
      const i = liste.findIndex((b, k) => !kullanildi.has(k) && b.uydu.norad === g.norad
        && Math.abs(b.tepe.ms - g.tepe) < 180e3);
      if (i < 0) { kacan.push({ sehir, ...g }); continue; }
      kullanildi.add(i);
      eslesen.push({ sehir, ref: g, biz: liste[i] });
    }
    liste.forEach((b, k) => { if (!kullanildi.has(k)) fazla.push({ sehir, b }); });
  }
  return { eslesen, kacan, fazla };
}

const sonuc = karsilastir();
const ozet = (dizi) => {
  const s = dizi.map(Math.abs).sort((a, b) => a - b);
  return { medyan: s[Math.floor(s.length / 2)], en_kotu: s[s.length - 1] };
};

test("skyfield ile aynı geçişler bulunuyor", () => {
  const { eslesen, kacan, fazla } = sonuc;
  const isim = (n) => veri.uydular.find((u) => u.norad === n).kod;
  for (const k of kacan) console.log("kaçan:", k.sehir, isim(k.norad), new Date(k.bas).toISOString(), k.tepeEl.toFixed(1));
  for (const f of fazla) console.log("fazla:", f.sehir, f.b.uydu.kod, new Date(f.b.bas.ms).toISOString(), f.b.tepe.el.toFixed(1));
  assert.ok(eslesen.length >= 40, `en az 40 eşleşme beklendi, ${eslesen.length}`);
  // Görünürlük sınırında (10° ya da gölge sınırında birkaç saniye) olan geçişler bir tarafta çıkıp
  // ötekinde çıkmayabilir; bunlar toplamın küçük bir kısmı olmalı.
  assert.ok(kacan.length + fazla.length <= Math.ceil(0.1 * eslesen.length), `kaçan ${kacan.length}, fazla ${fazla.length}`);
});

test("başlangıç, tepe, bitiş zamanı ve tepe yüksekliği skyfield'a yakın", () => {
  const { eslesen } = sonuc;
  const dBas = eslesen.map((e) => (e.biz.bas.ms - e.ref.bas) / 1000);
  const dTepe = eslesen.map((e) => (e.biz.tepe.ms - e.ref.tepe) / 1000);
  const dSon = eslesen.map((e) => (e.biz.son.ms - e.ref.son) / 1000);
  const dEl = eslesen.map((e) => e.biz.tepe.el - e.ref.tepeEl);
  const rapor = {
    gecis: eslesen.length, sehir: new Set(eslesen.map((e) => e.sehir)).size,
    bas_sn: ozet(dBas), tepe_sn: ozet(dTepe), son_sn: ozet(dSon), tepe_yukseklik_derece: ozet(dEl),
  };
  console.log(JSON.stringify(rapor));
  fs.writeFileSync(new URL("./olcum.json", import.meta.url), JSON.stringify(rapor, null, 1));
  assert.ok(rapor.tepe_sn.en_kotu <= 3, "tepe zamanı 3 sn içinde");
  assert.ok(rapor.bas_sn.en_kotu <= 3 && rapor.son_sn.en_kotu <= 3, "başlangıç/bitiş 3 sn içinde");
  assert.ok(rapor.tepe_yukseklik_derece.en_kotu <= 0.2, "tepe yüksekliği 0,2° içinde");
});

test("Güneş yüksekliği JPL DE421'e 0,1° yakın", () => {
  let enKotu = 0;
  for (const [enl, boy, ms, alt] of ref.gunes) {
    enKotu = Math.max(enKotu, Math.abs(gunesYuksekligi(sat, ms, gozlemci(enl, boy)) - alt));
  }
  console.log("güneş en kötü fark (°):", enKotu.toFixed(4));
  assert.ok(enKotu < 0.1);
});

test("gölge: Dünya'nın arkasındaki uydu karanlıkta", () => {
  const gunes = { x: 1.5e8, y: 0, z: 0 };
  assert.equal(gunesteMi({ x: -7000, y: 0, z: 0 }, gunes), false);
  assert.equal(gunesteMi({ x: -7000, y: 7000, z: 0 }, gunes), true);
  assert.equal(gunesteMi({ x: 7000, y: 0, z: 0 }, gunes), true);
});

test("yön ve yükseklik sözcükleri", () => {
  assert.equal(yon(0), "Kuzey");
  assert.equal(yon(359), "Kuzey");
  assert.equal(yon(44), "Kuzeydoğu");
  assert.equal(yon(90), "Doğu");
  assert.equal(yon(200), "Güney");
  assert.equal(yon(292), "Batı");
  assert.equal(yon(316), "Kuzeybatı");
  assert.equal(yukseklikSozu(80), "neredeyse tam tepede");
  assert.equal(yukseklikSozu(12), "alçakta, ufka yakın");
});

test("81 il, Türkiye sınırları içinde", () => {
  assert.equal(ILLER.length, 81);
  assert.deepEqual(ILLER.map((i) => i[0]), Array.from({ length: 81 }, (_, i) => i + 1));
  for (const [, ad, enl, boy] of ILLER) {
    assert.ok(enl > 35.8 && enl < 42.2 && boy > 25.6 && boy < 44.9, ad);
  }
});

// Heavens-Above (farklı yazılım, kendi yörünge verisi) ile karşılaştırma: 3 şehir, ISS ve Tiangong,
// 5–15 Kasım 2026. HA tam saniye ve tam derece verir; görünürlüğün alacakaranlıkta başladığı an
// için HA'nın ölçütü bizimkinden (Güneş ≤ −6°) biraz daha gevşek, bu yüzden birkaç geçiş farklı başlar.
test("Heavens-Above ile ISS ve Tiangong geçişleri", () => {
  const ha = oku("./heavens_above.json");
  const bas = Date.parse("2026-11-05T00:00:00Z"), son = Date.parse("2026-11-15T00:00:00Z");
  const zam = (gun, s) => Date.parse(`2026-11-${gun.split(" ")[0].padStart(2, "0")}T${s}Z`);
  let toplam = 0, yakin = 0, bulunamayan = 0;
  const dZaman = [], dEl = [];
  for (const [k, satirlar] of Object.entries(ha.gecisler)) {
    const [sehir, n] = k.split("|");
    const [enl, boy] = ha.sehirler[sehir];
    const { liste } = tumGecisler(sat, veri.uydular.filter((u) => u.norad === Number(n)), enl, boy, bas, son);
    for (const s of satirlar) {
      toplam++;
      const c = s.split("|");
      const tb = zam(c[0], c[2]), tt = zam(c[0], c[5]), ts = zam(c[0], c[8]);
      const b = liste.find((g) => g.bas.ms <= ts + 5000 && g.son.ms >= tb - 5000);
      if (!b) { bulunamayan++; continue; }
      const fz = [b.bas.ms - tb, b.tepe.ms - tt, b.son.ms - ts].map((x) => Math.abs(x) / 1000);
      const fe = Math.abs(b.tepe.el - parseInt(c[6], 10));
      if (Math.max(...fz) <= 5 && fe <= 1) { yakin++; dZaman.push(...fz); dEl.push(fe); }
    }
  }
  const rapor = { ha_gecis: toplam, ayni_sonuc: yakin, bulunamayan,
    ayni_olanlarda_zaman_sn: ozet(dZaman), ayni_olanlarda_tepe_derece: ozet(dEl) };
  console.log("heavens-above:", JSON.stringify(rapor));
  fs.writeFileSync(new URL("./olcum_heavens_above.json", import.meta.url), JSON.stringify(rapor, null, 1));
  assert.ok(yakin >= 0.8 * toplam, `${yakin}/${toplam}`);
  assert.ok(bulunamayan <= 2);
});
