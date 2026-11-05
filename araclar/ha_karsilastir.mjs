import fs from "fs"; import { createRequire } from "module";
import { tumGecisler } from "../site/js/gecis.js";
const sat = createRequire(import.meta.url)("satellite.js");
const ha = JSON.parse(fs.readFileSync("testler/heavens_above.json", "utf8"));
const v = JSON.parse(fs.readFileSync("testler/uydular_sabit.json", "utf8"));
const bas = Date.parse("2026-11-05T00:00:00Z"), son = Date.parse("2026-11-15T00:00:00Z");
const zam = (gun, s) => Date.parse(`2026-11-${gun.split(" ")[0].padStart(2, "0")}T${s}Z`);
for (const [k, satirlar] of Object.entries(ha.gecisler)) {
  const [sehir, n] = k.split("|"); const [enl, boy] = ha.sehirler[sehir];
  const { liste } = tumGecisler(sat, v.uydular.filter(u => u.norad == n), enl, boy, bas, son);
  for (const s of satirlar) {
    const c = s.split("|"); const tb = zam(c[0], c[2]), tt = zam(c[0], c[5]), ts = zam(c[0], c[8]);
    const b = liste.find(g => Math.abs(g.tepe.ms - tt) < 300e3 || (g.bas.ms <= ts && g.son.ms >= tb));
    console.log(k, c[0], c[5], parseInt(c[6]), b ? [((b.bas.ms - tb)/1e3).toFixed(0), ((b.tepe.ms - tt)/1e3).toFixed(0), ((b.son.ms - ts)/1e3).toFixed(0), (b.tepe.el - parseInt(c[6])).toFixed(1)].join(" ") : "YOK");
  }
  console.log(k, "bizde toplam", liste.length, "HA", satirlar.length);
}
