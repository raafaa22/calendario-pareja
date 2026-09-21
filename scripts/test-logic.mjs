/**
 * Pruebas de la logica pura: reglas de repeticion, etiquetas y huecos libres.
 * Son las partes con mas casos raros y las unicas que se pueden comprobar sin
 * hablar con Google. Se ejecutan con `npm test`.
 *
 * Usa el esbuild que ya trae Vite para compilar el TypeScript al vuelo, asi no
 * hace falta instalar nada mas.
 */
import { build } from 'esbuild'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const dir = mkdtempSync(join(tmpdir(), 'cp-'))
const out = join(dir, 'b.mjs')
writeFileSync(join(dir, 'entry.ts'), `
export * from '${root}/src/lib/recurrence.ts'
export * as tags from '${root}/src/lib/tags.ts'
export * as free from '${root}/src/lib/freeSlots.ts'
`)
await build({ entryPoints: [join(dir,'entry.ts')], bundle: true, format: 'esm', outfile: out,
  define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': '"x"' } })

const m = await import(out)
let pass = 0, fail = 0
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  ok ? pass++ : (fail++, console.log(`FALLO ${name}\n  esperado ${JSON.stringify(b)}\n  obtenido ${JSON.stringify(a)}`))
}

// --- RRULE ---
const mar = new Date(2026, 8, 22, 18, 0) // martes
eq('sin repeticion', m.buildRecurrence({freq:'none',byDay:[]}, mar), undefined)
eq('semanal L y X', m.buildRecurrence({freq:'weekly',byDay:[1,3]}, mar), ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE'])
eq('quincenal J', m.buildRecurrence({freq:'biweekly',byDay:[4]}, mar), ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH'])
eq('semanal sin dias usa el del evento', m.buildRecurrence({freq:'weekly',byDay:[]}, mar), ['RRULE:FREQ=WEEKLY;BYDAY=TU'])
eq('diaria', m.buildRecurrence({freq:'daily',byDay:[]}, mar), ['RRULE:FREQ=DAILY'])
eq('mensual', m.buildRecurrence({freq:'monthly',byDay:[]}, mar), ['RRULE:FREQ=MONTHLY'])
eq('anual', m.buildRecurrence({freq:'yearly',byDay:[]}, mar), ['RRULE:FREQ=YEARLY'])

const until = m.buildRecurrence({freq:'weekly',byDay:[1],until:'2026-12-31'}, mar)[0]
console.log('  con fecha fin ->', until)
eq('UNTIL en formato UTC', /UNTIL=\d{8}T\d{6}Z$/.test(until), true)

// --- ida y vuelta ---
for (const spec of [
  {freq:'weekly',byDay:[1,3,5]},
  {freq:'biweekly',byDay:[2]},
  {freq:'daily',byDay:[]},
  {freq:'monthly',byDay:[]},
]) {
  const back = m.parseRecurrence(m.buildRecurrence(spec, mar))
  eq(`vuelta ${spec.freq}`, {freq:back.freq, byDay:back.byDay}, {freq:spec.freq, byDay:spec.byDay})
}
eq('lee RRULE de Google', m.parseRecurrence(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T225959Z']),
   {freq:'biweekly', byDay:[1,3], until:'2026-12-31'})
eq('sin recurrencia', m.parseRecurrence(undefined), {freq:'none',byDay:[]})
eq('descripcion', m.describeRecurrence({freq:'biweekly',byDay:[1,3]}), 'Semana sí, semana no · lun, mié')

// --- etiquetas ---
const d = m.tags.buildDescription('Traer la receta', ['medico','fisio'])
eq('crea descripcion', d, 'Traer la receta\n\n#medico #fisio')
eq('lee descripcion', m.tags.parseDescription(d), {notes:'Traer la receta', tags:['medico','fisio']})
eq('ignora hashtags desconocidos', m.tags.parseDescription('Mira #esto y #gym'), {notes:'Mira #esto y', tags:['gym']})
eq('sin descripcion', m.tags.parseDescription(null), {notes:'', tags:[]})
eq('solo etiquetas', m.tags.parseDescription('#cena'), {notes:'', tags:['cena']})

// --- huecos libres ---
const day = new Date(2026, 8, 21)
const ev = (h, dur) => {
  const s = new Date(day); s.setHours(h,0,0,0)
  return { start: s, end: new Date(s.getTime()+dur*3600e3), allDay: false }
}
eq('dia vacio = un hueco 8-23', m.free.freeSlotsForDay(day, [], 60).map(s=>[s.start.getHours(), s.end.getHours()]), [[8,23]])
eq('parte el dia', m.free.freeSlotsForDay(day, [ev(9,4), ev(17,1)], 60).map(s=>[s.start.getHours(), s.end.getHours()]), [[8,9],[13,17],[18,23]])
eq('une solapados', m.free.freeSlotsForDay(day, [ev(9,4), ev(10,5)], 60).map(s=>[s.start.getHours(), s.end.getHours()]), [[8,9],[15,23]])
// 13:00-13:30 son 30 min y se descartan; 8:00-9:00 se mantiene.
eq('descarta huecos cortos', m.free.freeSlotsForDay(day, [ev(9,4), ev(13.5,9.5)], 60).map(s=>[s.start.getHours(), s.end.getHours()]), [[8,9]])
eq('dia completo bloquea', m.free.freeSlotsForDay(day, [{start:day, end:new Date(day.getTime()+86399e3), allDay:true}], 60), [])
eq('duracion', [m.free.formatDuration(90), m.free.formatDuration(60), m.free.formatDuration(45)], ['1 h 30 min','1 h','45 min'])

console.log(`\n${pass} pasan, ${fail} fallan`)
process.exit(fail ? 1 : 0)
