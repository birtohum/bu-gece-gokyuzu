// Görünür uydu geçişlerini hesaplar. Tarayıcıda ve Node testlerinde aynı kod çalışır;
// SGP4 kütüphanesi (satellite.js) dışarıdan verilir.
//
// "Görünür" = uydu ufkun en az 10° üstünde, Güneş ışığı alıyor ve gözlemcinin bulunduğu yerde
// Güneş ufkun en az 6° altında (sivil alacakaranlık bitmiş).

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const YER_YARICAP = 6378.137; // km (WGS-84 ekvator)
const AU = 149597870.7; // km

export const ESIK = { uyduYukseklik: 10, gunesAlcak: -6 };

export function julyen(ms) {
  return ms / 86400000 + 2440587.5;
}

// Düşük duyarlıklı Güneş konumu (Astronomical Almanac, ~0,01°). Yer merkezli ekvatoral, km.
export function gunesECI(ms) {
  const n = julyen(ms) - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const R = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AU;
  return {
    x: R * Math.cos(lam),
    y: R * Math.cos(eps) * Math.sin(lam),
    z: R * Math.sin(eps) * Math.sin(lam),
  };
}

export function gozlemci(enlem, boylam, yukseklikKm = 0) {
  return { latitude: enlem * RAD, longitude: boylam * RAD, height: yukseklikKm };
}

function bakis(sat, eci, ms, gz) {
  const gmst = sat.gstime(new Date(ms));
  const ecf = sat.eciToEcf(eci, gmst);
  const b = sat.ecfToLookAngles(gz, ecf);
  return { az: ((b.azimuth * DEG) % 360 + 360) % 360, el: b.elevation * DEG, uzaklik: b.rangeSat };
}

export function gunesYuksekligi(sat, ms, gz) {
  return bakis(sat, gunesECI(ms), ms, gz).el;
}

// Uydu ile Güneş arasındaki doğru parçası Dünya küresini kesiyorsa uydu gölgededir.
export function gunesteMi(r, s) {
  const dx = s.x - r.x, dy = s.y - r.y, dz = s.z - r.z;
  const L = Math.hypot(dx, dy, dz);
  const ux = dx / L, uy = dy / L, uz = dz / L;
  const b = r.x * ux + r.y * uy + r.z * uz;
  const c = r.x * r.x + r.y * r.y + r.z * r.z - YER_YARICAP * YER_YARICAP;
  const disk = b * b - c;
  if (disk < 0) return true;
  return -b - Math.sqrt(disk) < 0; // kesişme uydunun arkasında kalıyorsa ışık alır
}

// Bir anda uydunun durumu; yayılım başarısızsa null.
export function durum(sat, satrec, ms, gz) {
  const p = sat.propagate(satrec, new Date(ms));
  if (!p || !p.position || isNaN(p.position.x)) return null;
  const b = bakis(sat, p.position, ms, gz);
  const gunes = gunesECI(ms);
  const gunesEl = bakis(sat, gunes, ms, gz).el;
  const isik = gunesteMi(p.position, gunes);
  return {
    ms, az: b.az, el: b.el, gunesEl, isik,
    gorunur: b.el >= ESIK.uyduYukseklik && isik && gunesEl <= ESIK.gunesAlcak,
  };
}

// [bas, son] aralığında Güneş'in ESIK.gunesAlcak altında kaldığı karanlık dilimler.
export function karanlikDilimler(sat, gz, bas, son, adim = 120000) {
  const dilimler = [];
  let acik = null;
  for (let t = bas; t <= son + adim; t += adim) {
    const tt = Math.min(t, son);
    const karanlik = gunesYuksekligi(sat, tt, gz) <= ESIK.gunesAlcak;
    if (karanlik && acik === null) acik = tt;
    if ((!karanlik || tt === son) && acik !== null) {
      dilimler.push([acik, tt]);
      acik = null;
    }
    if (tt === son) break;
  }
  // Kenarları ±1 sn'ye inceltmeye gerek yok: geçiş sınırları ayrıca ince ayarlanıyor,
  // burada yalnız aramanın nereye bakacağını seçiyoruz. Pay bırak.
  return dilimler.map(([a, b]) => [a - adim, b + adim]);
}

function ikiye(f, a, b, hassas = 500) {
  // f(a) != f(b); geçiş anını hassas ms içinde bulur.
  const fa = f(a);
  while (b - a > hassas) {
    const m = (a + b) / 2;
    if (f(m) === fa) a = m; else b = m;
  }
  return (a + b) / 2;
}

// Tek uydunun karanlık dilimlerdeki görünür geçişleri.
export function gecisleriBul(sat, satrec, gz, dilimler, secenek = {}) {
  const kaba = secenek.kabaAdim ?? 30000;
  const ince = secenek.inceAdim ?? 5000;
  const sonuc = [];
  for (const [d0, d1] of dilimler) {
    let t = d0;
    while (t <= d1) {
      const s = durum(sat, satrec, t, gz);
      if (!s) { t += kaba; continue; }
      if (s.el < 0) {
        // Ufkun altında; yükseklik çok düşükse daha büyük adım (yörünge hızına göre güvenli).
        t += s.el < -30 ? kaba * 4 : kaba;
        continue;
      }
      // Ufkun üstünde bir yay: ince adımlarla baştan sona tara.
      let a = t - kaba;
      const ornek = [];
      let u = a;
      for (; ; u += ince) {
        const o = durum(sat, satrec, u, gz);
        if (!o) break;
        ornek.push(o);
        if (u > t && o.el < 0) break;
        if (u - a > 3 * 3600e3) break; // yüksek yörüngede emniyet
      }
      t = u + kaba;
      const g = gorunurKisim(sat, satrec, gz, ornek);
      if (g) sonuc.push(g);
    }
  }
  return sonuc;
}

function gorunurKisim(sat, satrec, gz, ornek) {
  const i0 = ornek.findIndex((o) => o.gorunur);
  if (i0 < 0) return null;
  let i1 = i0;
  while (i1 + 1 < ornek.length && ornek[i1 + 1].gorunur) i1++;
  const gor = (ms) => { const o = durum(sat, satrec, ms, gz); return !!(o && o.gorunur); };
  const bas = i0 > 0 ? ikiye(gor, ornek[i0 - 1].ms, ornek[i0].ms) : ornek[i0].ms;
  const son = i1 + 1 < ornek.length ? ikiye(gor, ornek[i1].ms, ornek[i1 + 1].ms) : ornek[i1].ms;
  // En yüksek nokta: görünür aralıkta altın oran araması.
  const el = (ms) => durum(sat, satrec, ms, gz).el;
  let a = bas, b = son;
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a), d = a + r * (b - a);
  while (b - a > 500) {
    if (el(c) > el(d)) { b = d; d = c; c = b - r * (b - a); }
    else { a = c; c = d; d = a + r * (b - a); }
  }
  const tepe = durum(sat, satrec, (a + b) / 2, gz);
  const ilk = durum(sat, satrec, bas, gz);
  const sonD = durum(sat, satrec, son, gz);
  // Bittiği an uydu hâlâ ufkun 10° üstündeyse gölgeye girip sönüyordur.
  const golgeyeGirer = sonD.el > ESIK.uyduYukseklik + 0.5 && !durum(sat, satrec, son + 2000, gz).isik;
  const yol = [];
  for (let m = bas; m < son; m += 10000) {
    const o = durum(sat, satrec, m, gz);
    yol.push([o.az, o.el]);
  }
  yol.push([sonD.az, sonD.el]);
  // Ufkun üstündeki yayın tamamı (görünmeyen kısımlar dahil), şemada soluk çizilir.
  const yay = ornek.filter((o) => o.el >= 0).map((o) => [o.az, o.el]);
  return {
    bas: ilk, tepe, son: sonD,
    sureSn: Math.round((son - bas) / 1000),
    golgeyeGirer, yol, yay,
  };
}

export function satrecYap(sat, u) {
  return sat.twoline2satrec(u.s1, u.s2);
}

// Tüm uydular için: [bas, son] aralığındaki görünür geçişler, zamana göre sıralı.
export function tumGecisler(sat, uydular, enlem, boylam, bas, son) {
  const gz = gozlemci(enlem, boylam, 0);
  const dilimler = karanlikDilimler(sat, gz, bas, son);
  const liste = [];
  for (const u of uydular) {
    const rec = u.satrec || (u.satrec = satrecYap(sat, u));
    for (const g of gecisleriBul(sat, rec, gz, dilimler)) {
      if (g.bas.ms < bas || g.bas.ms > son) continue;
      liste.push({ uydu: u, ...g });
    }
  }
  liste.sort((x, y) => x.bas.ms - y.bas.ms);
  return { liste, dilimler };
}

const YONLER = ["Kuzey", "Kuzeydoğu", "Doğu", "Güneydoğu", "Güney", "Güneybatı", "Batı", "Kuzeybatı"];
export function yon(az) {
  return YONLER[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}

export function yukseklikSozu(el) {
  if (el >= 75) return "neredeyse tam tepede";
  if (el >= 50) return "yüksekte";
  if (el >= 25) return "orta yükseklikte";
  return "alçakta, ufka yakın";
}
