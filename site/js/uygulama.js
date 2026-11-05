import { ILLER } from "./iller.js";
import { yon, yukseklikSozu } from "./gecis.js";

const $ = (id) => document.getElementById(id);
const BOLGE = "Europe/Istanbul";
const saatFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: BOLGE, hour: "2-digit", minute: "2-digit" });
const gunFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: BOLGE, weekday: "long", day: "numeric", month: "long" });
const kisaGunFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: BOLGE, day: "numeric", month: "long" });
const saat = (ms) => saatFmt.format(new Date(ms));

const PARLAKLIK = { 25544: "çok parlak", 48274: "parlak" };
const ONE_CIKAN = new Set([25544, 48274]);
const DEN = { Kuzey: "kuzeyden", Kuzeydoğu: "kuzeydoğudan", Doğu: "doğudan", Güneydoğu: "güneydoğudan",
  Güney: "güneyden", Güneybatı: "güneybatıdan", Batı: "batıdan", Kuzeybatı: "kuzeybatıdan" };
const YA = { Kuzey: "kuzeye", Kuzeydoğu: "kuzeydoğuya", Doğu: "doğuya", Güneydoğu: "güneydoğuya",
  Güney: "güneye", Güneybatı: "güneybatıya", Batı: "batıya", Kuzeybatı: "kuzeybatıya" };
const kucuk = (s) => s.toLocaleLowerCase("tr-TR");

let veri = null, sonuc = null, secili = null, hepsi = false;
let yer = null; // { enlem, boylam, ad, konum: bool }
let kimlik = 0;

function sure(sn) {
  const d = Math.floor(sn / 60), s = sn % 60;
  if (d === 0) return `${s} saniye`;
  return s >= 30 ? `${d} buçuk dakika` : `${d} dakika`;
}

function geriSayim(g, simdi) {
  if (simdi >= g.bas.ms && simdi <= g.son.ms) return "Şu an geçiyor, hemen bakın!";
  const dk = Math.round((g.bas.ms - simdi) / 60000);
  if (dk < 1) return "Birazdan başlıyor";
  if (dk < 60) return `${dk} dakika sonra`;
  const sa = Math.floor(dk / 60), kalan = dk % 60;
  return kalan ? `${sa} saat ${kalan} dakika sonra` : `${sa} saat sonra`;
}

function cumle(g) {
  const y0 = yon(g.bas.az), y1 = yon(g.son.az);
  const el = Math.round(g.tepe.el);
  let s = y0 === y1
    ? `Gökyüzünün ${kucuk(y0)} tarafında görünür.`
    : `${DEN[y0][0].toLocaleUpperCase("tr-TR") + DEN[y0].slice(1)} çıkar, ${YA[y1]} doğru gider.`;
  s += ` En yüksek noktası ${el}° (${yukseklikSozu(g.tepe.el)}), saat ${saat(g.tepe.ms)}.`;
  s += ` Yaklaşık ${sure(g.sureSn)} görünür`;
  s += g.golgeyeGirer ? "; sonunda Dünya'nın gölgesine girip söner." : ".";
  return s;
}

// --- Gökyüzü haritası (yukarıdan bakış: üst kuzey, sağ doğu) ---
const R = 110;
function nokta(az, el) {
  const r = (R * (90 - Math.max(0, el))) / 90, a = (az * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}
const yolD = (pts) => pts.map(([az, el], i) => (i ? "L" : "M") + nokta(az, el).map((v) => v.toFixed(1)).join(" ")).join("");

function kubbe(g) {
  const svg = $("kubbe");
  const ns = "http://www.w3.org/2000/svg";
  let h = `<title id="kubbe-baslik">${g ? g.ad + " için gökyüzünde izlenecek yol" : "Gökyüzü"}</title>`;
  h += `<circle class="ufuk" r="${R}"/>`;
  for (const e of [30, 60]) h += `<circle class="halka" r="${(R * (90 - e)) / 90}"/>`;
  h += `<line class="halka" x1="${-R}" y1="0" x2="${R}" y2="0"/><line class="halka" x1="0" y1="${-R}" x2="0" y2="${R}"/>`;
  h += `<text class="derece-yazi" x="3" y="${-(R * 60) / 90 + 9}">30°</text><text class="derece-yazi" x="3" y="${-(R * 30) / 90 + 9}">60°</text>`;
  const yy = R + 12;
  h += `<text class="yon-yazi" x="0" y="${-yy}">Kuzey</text><text class="yon-yazi" x="0" y="${yy}">Güney</text>`;
  h += `<text class="yon-yazi" x="${yy + 2}" y="0" transform="rotate(90 ${yy + 2} 0)">Doğu</text>`;
  h += `<text class="yon-yazi" x="${-yy - 2}" y="0" transform="rotate(-90 ${-yy - 2} 0)">Batı</text>`;
  if (g) {
    if (g.yay.length > 1) h += `<path class="yay" d="${yolD(g.yay)}"/>`;
    h += `<path class="yol" d="${yolD(g.yol)}"/>`;
    const [bx, by] = nokta(g.bas.az, g.bas.el);
    h += `<circle class="bas" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="5"/>`;
    // Bitişte küçük ok ucu
    const n = g.yol.length;
    if (n > 1) {
      const [x1, y1] = nokta(...g.yol[n - 2]), [x2, y2] = nokta(...g.yol[n - 1]);
      const a = Math.atan2(y2 - y1, x2 - x1), L = 9;
      const p = (d) => [x2 - L * Math.cos(a + d), y2 - L * Math.sin(a + d)].map((v) => v.toFixed(1)).join(" ");
      h += `<path class="yol" d="M${p(0.5)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${p(-0.5)}"/>`;
    }
    const tx = bx + (bx > 40 ? -8 : 8), anchor = bx > 40 ? "end" : "start";
    h += `<text class="zaman-yazi" x="${tx.toFixed(1)}" y="${(by - 8).toFixed(1)}" text-anchor="${anchor}">${saat(g.bas.ms)}</text>`;
  }
  svg.innerHTML = h;
  void ns;
}

function siradakiGoster(g, etiket) {
  $("siradaki").hidden = !g;
  if (!g) return;
  $("sir-etiket").textContent = etiket;
  $("sir-ad").textContent = g.ad;
  $("sir-saat").innerHTML = `${saat(g.bas.ms)}<small>${geriSayim(g, Date.now())}</small>`;
  $("sir-cumle").textContent = cumle(g);
  kubbe(g);
  const yas = (Date.now() - Date.parse(g.epoch)) / 3600e3;
  const guncel = (Date.now() - Date.parse(veri.guncelleme)) / 3600e3;
  $("veri-yasi").textContent = `Bu geçişin yörünge verisi ${yas < 48 ? Math.round(yas) + " saat" : Math.round(yas / 24) + " gün"} eski.`
    + (guncel > 72 ? ` Dikkat: veri ${Math.round(guncel / 24)} gündür yenilenmedi, saatler birkaç dakika kayabilir.` : "");
  document.querySelectorAll("#liste li").forEach((li) => li.setAttribute("aria-current", li.dataset.k === anahtar(g) ? "true" : "false"));
}

function yonler(g) {
  const y0 = kucuk(yon(g.bas.az)), y1 = kucuk(yon(g.son.az));
  return y0 === y1 ? y0 : `${y0} → ${y1}`;
}

const anahtar = (g) => `${g.norad}-${g.bas.ms}`;

function listeGoster() {
  const { liste } = sonuc;
  const simdi = Date.now();
  const gelecek = liste.filter((g) => g.son.ms >= simdi);
  const goster = hepsi ? gelecek : gelecek.filter((g) => ONE_CIKAN.has(g.norad) || g.tepe.el >= 40);
  const ol = $("liste");
  ol.innerHTML = "";
  for (const g of goster) {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.dataset.k = anahtar(g);
    const rozet = PARLAKLIK[g.norad] ? `<span class="rozet">${PARLAKLIK[g.norad]}</span>` : "";
    
    li.innerHTML = `<span class="saat">${saat(g.bas.ms)}</span><span class="ad"></span>
      <span class="ayrinti">${yonler(g)} · en yüksek ${Math.round(g.tepe.el)}° · ${sure(g.sureSn)}</span>`;
    li.querySelector(".ad").textContent = g.ad;
    li.querySelector(".ad").insertAdjacentHTML("beforeend", rozet);
    const sec = () => { secili = g; siradakiGoster(g, g === ilkSiradaki() ? "Sıradaki" : "Seçtiğiniz geçiş"); $("siradaki").scrollIntoView({ behavior: "smooth", block: "start" }); };
    li.addEventListener("click", sec);
    li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sec(); } });
    ol.appendChild(li);
  }
  const gizli = gelecek.length - goster.length;
  const btn = $("hepsi");
  btn.hidden = !hepsi && gizli === 0;
  btn.textContent = hepsi ? "Yalnız öne çıkanları göster" : `Sönük ve alçak geçişleri de göster (${gizli} tane daha)`;
  $("liste-bolum").hidden = gelecek.length === 0;
}

function ilkSiradaki() {
  const simdi = Date.now();
  const gelecek = sonuc.liste.filter((g) => g.son.ms >= simdi);
  return gelecek.find((g) => ONE_CIKAN.has(g.norad)) || gelecek.find((g) => g.tepe.el >= 40) || gelecek[0] || null;
}

function goster() {
  const simdi = Date.now();
  const [g0, g1] = sonuc.gece;
  const bas = g0 + 120000, son = g1 - 120000; // karanlık dilim 2 dk'lık adımla bulunur
  const karanlik = simdi >= bas && simdi <= son;
  $("durum").textContent = `${yer.ad} · uydu görmeye yetecek karanlık: yaklaşık ${saat(bas)} – ${saat(son)}`
    + (karanlik ? " (şu an karanlık)" : "");
  $("liste-baslik").textContent = `Bu gece görünenler (${kisaGunFmt.format(new Date(bas))} akşamı – ${kisaGunFmt.format(new Date(son))} sabahı)`;

  const ilk = ilkSiradaki();
  if (!secili || secili.son.ms < simdi) secili = ilk;
  siradakiGoster(secili, secili === ilk ? (ONE_CIKAN.has(secili?.norad) || !secili ? "Sıradaki" : "Sıradaki (sönük olabilir)") : "Seçtiğiniz geçiş");

  // Bu gece görünmeyen istasyon(lar) için sonraki görünür geçiş.
  const eksik = [[25544, "Uluslararası Uzay İstasyonu"], [48274, "Tiangong"]]
    .filter(([n]) => !sonuc.liste.some((g) => g.norad === n && g.son.ms >= simdi));
  $("yok").hidden = eksik.length === 0;
  if (eksik.length) {
    $("yok-baslik").textContent = eksik.length === 2 ? "Bu gece uzay istasyonu geçişi yok" : `${eksik[0][1]} bu gece görünmüyor`;
    const parca = eksik.map(([n, ad]) => {
      const s = sonuc.sonraki[n];
      return s ? `${ad}: ${gunFmt.format(new Date(s.bas.ms))}, saat ${saat(s.bas.ms)}, ${yonler(s)}, en yüksek ${Math.round(s.tepe.el)}°.`
        : `${ad}: önümüzdeki 10 gecede görünür geçiş yok.`;
    });
    $("yok-metin").innerHTML = (eksik.length === 2 ? "İstasyonlar" : "İstasyon")
      + " bu gece ya ufkun altından geçiyor ya da Dünya'nın gölgesinde kalıyor. Sonraki görünür geçiş:<br>" + parca.join("<br>");
  }
  listeGoster();
}

function hesapla() {
  $("durum").textContent = `${yer.ad} için hesaplanıyor…`;
  kimlik++;
  isci.postMessage({ tur: "hesapla", enlem: yer.enlem, boylam: yer.boylam, simdi: Date.now(), kimlik });
}

function enYakinIl(enl, boy) {
  let en = null, d = Infinity;
  for (const il of ILLER) {
    const dd = (il[2] - enl) ** 2 + ((il[3] - boy) * Math.cos((enl * Math.PI) / 180)) ** 2;
    if (dd < d) { d = dd; en = il; }
  }
  return { il: en, km: Math.sqrt(d) * 111 };
}

function ilSec(plaka) {
  const il = ILLER.find((i) => i[0] === plaka) || ILLER[33];
  yer = { enlem: il[2], boylam: il[3], ad: il[1], konum: false };
  $("il").value = String(il[0]);
  $("yer-bilgi").textContent = "";
  try { localStorage.setItem("il", String(il[0])); } catch { /* özel pencere */ }
  secili = null;
  hesapla();
}

const isci = new Worker(new URL("./hesap.js", import.meta.url), { type: "module" });
isci.onmessage = (e) => {
  if (e.data.kimlik !== kimlik) return;
  sonuc = e.data;
  goster();
};
isci.onerror = () => { $("durum").textContent = "Hesap yapılamadı. Tarayıcınız çok eskiyse güncellemeyi deneyin."; };

async function baslat() {
  const sel = $("il");
  for (const [p, ad] of [...ILLER].sort((a, b) => a[1].localeCompare(b[1], "tr"))) {
    const o = document.createElement("option");
    o.value = String(p); o.textContent = ad;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => ilSec(Number(sel.value)));
  $("hepsi").addEventListener("click", () => { hepsi = !hepsi; listeGoster(); });
  $("konum").addEventListener("click", () => {
    if (!navigator.geolocation) { $("yer-bilgi").textContent = "Tarayıcınız konum vermiyor; listeden şehir seçin."; return; }
    $("yer-bilgi").textContent = "Konum soruluyor…";
    navigator.geolocation.getCurrentPosition((p) => {
      const { latitude: enl, longitude: boy } = p.coords;
      const { il, km } = enYakinIl(enl, boy);
      $("il").value = String(il[0]);
      yer = { enlem: enl, boylam: boy, ad: km < 60 ? `Konumunuz (${il[1]} yakını)` : "Konumunuz", konum: true };
      $("yer-bilgi").textContent = `Tam konumunuz kullanılıyor (${enl.toFixed(2)}, ${boy.toFixed(2)}). Konum cihazınızdan dışarı gönderilmez.`;
      secili = null;
      hesapla();
    }, () => { $("yer-bilgi").textContent = "Konum alınamadı; listeden şehir seçin."; }, { timeout: 15000, maximumAge: 600000 });
  });

  kubbe(null);
  try {
    const r = await fetch(`veri/uydular.json?s=${Math.floor(Date.now() / 3600e3)}`);
    veri = await r.json();
  } catch {
    $("durum").textContent = "Uydu verisi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.";
    return;
  }
  isci.postMessage({ tur: "veri", uydular: veri.uydular });
  let kayitli = 34;
  try { kayitli = Number(localStorage.getItem("il")) || 34; } catch { /* yok */ }
  ilSec(kayitli);

  // Geri sayımı dakikada bir tazele; gece bitince ya da 30 dakikada bir yeniden hesapla.
  let sonHesap = Date.now();
  setInterval(() => {
    if (!sonuc) return;
    if (Date.now() - sonHesap > 30 * 60e3 || Date.now() > sonuc.gece[1]) { sonHesap = Date.now(); hesapla(); return; }
    goster();
  }, 60e3);
}

baslat();
