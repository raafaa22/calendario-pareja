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
export * as dates from '${root}/src/lib/dates.ts'
export * as theme from '${root}/src/lib/theme.ts'
export * as owners from '${root}/src/lib/owners.ts'
export * as guess from '${root}/src/lib/calendarGuess.ts'
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
const spec = (o = {}) => ({ freq: 'weekly', interval: 1, byDay: [], ...o })

eq('sin repeticion', m.buildRecurrence(spec({freq:'none'}), mar), undefined)
eq('semanal L y X', m.buildRecurrence(spec({byDay:[1,3]}), mar), ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE'])
eq('quincenal J', m.buildRecurrence(spec({interval:2, byDay:[4]}), mar), ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH'])
eq('semanal sin dias usa el del evento', m.buildRecurrence(spec(), mar), ['RRULE:FREQ=WEEKLY;BYDAY=TU'])
eq('diaria', m.buildRecurrence(spec({freq:'daily'}), mar), ['RRULE:FREQ=DAILY'])
eq('cada 3 dias', m.buildRecurrence(spec({freq:'daily', interval:3}), mar), ['RRULE:FREQ=DAILY;INTERVAL=3'])
eq('cada 2 meses', m.buildRecurrence(spec({freq:'monthly', interval:2}), mar), ['RRULE:FREQ=MONTHLY;INTERVAL=2'])
eq('anual', m.buildRecurrence(spec({freq:'yearly'}), mar), ['RRULE:FREQ=YEARLY'])
eq('interval 1 no se escribe', m.buildRecurrence(spec({freq:'monthly', interval:1}), mar), ['RRULE:FREQ=MONTHLY'])
eq('numero de veces', m.buildRecurrence(spec({freq:'daily', count:10}), mar), ['RRULE:FREQ=DAILY;COUNT=10'])
// UNTIL y COUNT son excluyentes en RRULE: solo debe salir uno.
eq('count gana a until', m.buildRecurrence(spec({freq:'daily', count:5, until:'2026-12-31'}), mar), ['RRULE:FREQ=DAILY;COUNT=5'])

const until = m.buildRecurrence(spec({byDay:[1], until:'2026-12-31'}), mar)[0]
console.log('  con fecha fin ->', until)
eq('UNTIL en formato UTC', /UNTIL=\d{8}T\d{6}Z$/.test(until), true)

// --- ida y vuelta ---
for (const s of [
  spec({byDay:[1,3,5]}),
  spec({interval:2, byDay:[2]}),
  spec({freq:'daily', interval:4}),
  spec({freq:'monthly', interval:3}),
  spec({freq:'yearly', count:7}),
]) {
  const back = m.parseRecurrence(m.buildRecurrence(s, mar))
  eq(`vuelta ${s.freq} x${s.interval}`,
     {freq:back.freq, interval:back.interval, byDay:back.byDay, count:back.count},
     {freq:s.freq, interval:s.interval, byDay:s.byDay, count:s.count})
}
eq('lee RRULE de Google', m.parseRecurrence(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T225959Z']),
   {freq:'weekly', interval:2, byDay:[1,3], until:'2026-12-31', count:undefined})
eq('sin recurrencia', m.parseRecurrence(undefined), {freq:'none', interval:1, byDay:[]})

// --- atajos de la interfaz ---
eq('atajo quincenal', m.presetOf(spec({interval:2})), 'biweekly')
eq('atajo semanal', m.presetOf(spec()), 'weekly')
eq('atajo mensual', m.presetOf(spec({freq:'monthly'})), 'monthly')
eq('dias concretos = personalizado', m.presetOf(spec({byDay:[1]})), 'custom')
eq('con fin = personalizado', m.presetOf(spec({until:'2026-12-31'})), 'custom')
eq('cada 3 semanas = personalizado', m.presetOf(spec({interval:3})), 'custom')
eq('preset a spec', m.specOfPreset('biweekly', m.NO_RECURRENCE), {freq:'weekly', interval:2, byDay:[]})

eq('texto quincenal', m.describeRecurrence(spec({interval:2, byDay:[1,3]})), 'Semana sí, semana no · lun, mié')
eq('texto cada 3 meses', m.describeRecurrence(spec({freq:'monthly', interval:3})), 'Cada 3 meses')
eq('texto con veces', m.describeRecurrence(spec({freq:'daily', count:5})), 'Cada día · 5 veces')
eq('texto una vez', m.describeRecurrence(spec({freq:'daily', count:1})), 'Cada día · 1 vez')

// --- etiquetas y emoji ---
const d = m.tags.buildDescription('Traer la receta', ['medico','fisio'])
eq('crea descripcion', d, 'Traer la receta\n\n#medico #fisio')
eq('lee descripcion', m.tags.parseDescription(d), {notes:'Traer la receta', tags:['medico','fisio'], emoji:undefined})
eq('ignora hashtags desconocidos', m.tags.parseDescription('Mira #esto y #gym'), {notes:'Mira #esto y', tags:['gym'], emoji:undefined})
eq('sin descripcion', m.tags.parseDescription(null), {notes:'', tags:[]})
eq('solo etiquetas', m.tags.parseDescription('#cena'), {notes:'', tags:['cena'], emoji:undefined})

const withEmoji = m.tags.buildDescription('Mesa para dos', ['cena'], '🍕')
eq('crea con emoji', withEmoji, 'Mesa para dos\n\n#cena [emoji:🍕]')
eq('lee el emoji', m.tags.parseDescription(withEmoji), {notes:'Mesa para dos', tags:['cena'], emoji:'🍕'})
eq('emoji sin etiquetas', m.tags.parseDescription('[emoji:🎂]'), {notes:'', tags:[], emoji:'🎂'})
eq('emoji vacio no se escribe', m.tags.buildDescription('Hola', [], ''), 'Hola')

// --- adivinar los calendarios en la primera configuracion ---
// En Google el ID del calendario principal de una cuenta ES su correo, asi que
// si tu pareja ya te compartio el suyo, su correo esta a la vista en tu lista.
const g = m.guess
eq('un correo normal es de persona', g.isPersonalEmailId('ana@gmail.com'), true)
eq('un grupo no lo es', g.isPersonalEmailId('abc123@group.calendar.google.com'), false)
eq('los festivos tampoco', g.isPersonalEmailId('es.spanish#holiday@group.v.calendar.google.com'), false)
eq('los cumpleanos tampoco', g.isPersonalEmailId('addressbook#contacts@group.v.calendar.google.com'), false)
eq('sin arroba no lo es', g.isPersonalEmailId('no-es-un-correo'), false)
eq('un dominio propio si', g.isPersonalEmailId('rafa@xauen.io'), true)

const cal = (id, extra = {}) => ({ id, summary: id, accessRole: 'reader', ...extra })
const lista = [
  cal('rafa@gmail.com', { primary: true, accessRole: 'owner' }),
  cal('es.spanish#holiday@group.v.calendar.google.com'),
  cal('nosotros@group.calendar.google.com', { accessRole: 'writer' }),
  cal('ana@gmail.com', { accessRole: 'writer' }),
]
eq('encuentra el correo de la pareja', g.detectPartnerEmail(lista, 'rafa@gmail.com'), 'ana@gmail.com')
eq('nunca devuelve el tuyo', g.detectPartnerEmail(lista, 'ana@gmail.com'), null)
eq('sin nada compartido no adivina', g.detectPartnerEmail([lista[0], lista[1]], 'rafa@gmail.com'), null)
// Un calendario propio que no sea el principal no es de la pareja.
eq('ignora los tuyos', g.detectPartnerEmail(
  [lista[0], cal('otro@gmail.com', { accessRole: 'owner' })], 'rafa@gmail.com'), null)

// El conjunto: ni principales, ni de Google, ni el personal de la pareja.
eq('candidatos a conjunto', g.ourCalendarCandidates(lista).map((c) => c.id),
   ['nosotros@group.calendar.google.com'])
eq('sin candidatos si solo hay personales', g.ourCalendarCandidates([lista[0], lista[3]]).map((c) => c.id), [])

// --- quien es quien en cada movil ---
// Los carriles son fijos en los dos telefonos, asi que el nombre que se ensena
// tiene que depender de quien ha entrado. Sin esto, en su movil saldria "Yo"
// en el calendario de el.
const cals = {
  mine: { id: 'a', summary: 'Mi agenda', label: '', editable: true },
  hers: { id: 'b', summary: 'Su agenda', label: '', editable: true },
  ours: { id: 'c', summary: 'Nosotros', label: '', editable: true },
}
eq('en su movil, yo soy el carril mine', m.owners.defaultOwnerLabels('mine'),
   { mine: 'Yo', hers: 'Mi pareja', ours: 'Nosotros' })
eq('en el de ella, yo soy el carril hers', m.owners.defaultOwnerLabels('hers'),
   { hers: 'Yo', mine: 'Mi pareja', ours: 'Nosotros' })
eq('el otro carril personal', [m.owners.partnerOf('mine'), m.owners.partnerOf('hers')], ['hers', 'mine'])
eq('ours no es una persona', [m.owners.isPerson('mine'), m.owners.isPerson('ours')], [true, false])

eq('sin nombre propio se usa el por defecto',
   m.owners.ownerLabels({ me: 'hers', calendars: cals }),
   { mine: 'Mi pareja', hers: 'Yo', ours: 'Nosotros' })
eq('el nombre propio manda sobre el por defecto',
   m.owners.ownerLabels({ me: 'hers', calendars: { ...cals, mine: { ...cals.mine, label: 'Rafa' } } }),
   { mine: 'Rafa', hers: 'Yo', ours: 'Nosotros' })
eq('un nombre en blanco no cuenta',
   m.owners.ownerLabels({ me: 'mine', calendars: { ...cals, hers: { ...cals.hers, label: '   ' } } }),
   { mine: 'Yo', hers: 'Mi pareja', ours: 'Nosotros' })
eq('un carril sin asignar tambien tiene nombre',
   m.owners.ownerLabels({ me: 'mine', calendars: {} }),
   { mine: 'Yo', hers: 'Mi pareja', ours: 'Nosotros' })

// --- mezcla de colores por tono ---
// Mezclando el tono (como la pintura), no los canales RGB: en RGB azul mas
// amarillo da gris, y por tono da verde, que es lo que espera cualquiera.
const hue = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min
  if (!d) return 0
  const h = max === r ? ((g-b)/d + (g<b?6:0)) : max === g ? ((b-r)/d + 2) : ((r-g)/d + 4)
  return Math.round(h * 60)
}
const near = (name, got, want, tol = 12) => {
  const d = Math.min(Math.abs(got - want), 360 - Math.abs(got - want))
  d <= tol ? pass++ : (fail++, console.log(`FALLO ${name}\n  esperado tono ~${want}\n  obtenido ${got}`))
}
near('azul + amarillo = verde', hue(m.theme.mixColors('#2563eb', '#ca8a04')), 133)
near('violeta + naranja = rosa', hue(m.theme.mixColors('#7c3aed', '#ea580c')), 327)
near('rosa + lima = ambar', hue(m.theme.mixColors('#db2777', '#65a30d')), 40)
near('azul + azul sigue azul', hue(m.theme.mixColors('#2563eb', '#2563eb')), hue('#2563eb'))

// Los tres colores de cada tema: el tercero tiene que ser la mezcla de los dos
// primeros, y ninguno acercarse al color de la interfaz de ese tema.
const CHROME = { azul: '#0284c7', rosa: '#db2777', verde: '#059669' }
for (const [name, [mine, hers, ours]] of Object.entries(m.theme.ACCENT_TRIAD)) {
  near(`trio ${name}: el tercero es la mezcla`, hue(m.theme.mixColors(mine, hers)), hue(ours), 20)
  eq(`trio ${name}: las dos personas bien separadas`, m.theme.hueDistance(mine, hers) >= 110, true)
  eq(`trio ${name}: nosotros lejos de la interfaz`, m.theme.hueDistance(ours, CHROME[name]) >= 120, true)
  eq(`trio ${name}: yo lejos de la interfaz`, m.theme.hueDistance(mine, CHROME[name]) >= 60, true)
  eq(`trio ${name}: ella lejos de la interfaz`, m.theme.hueDistance(hers, CHROME[name]) >= 60, true)
}

// Con colores a medida: lo que no se elige se calcula.
const custom = { mine: '#2563eb', hers: '#ca8a04', ours: null, chrome: null }
eq('nosotros automatico es la mezcla', m.theme.resolveOurs(custom), m.theme.mixColors('#2563eb', '#ca8a04'))
eq('nosotros a mano manda', m.theme.resolveOurs({ ...custom, ours: '#ff0000' }), '#ff0000')
eq('interfaz automatica queda enfrente de nosotros',
   m.theme.hueDistance(m.theme.resolveChrome(custom), m.theme.resolveOurs(custom)) >= 175, true)
eq('interfaz a mano manda', m.theme.resolveChrome({ ...custom, chrome: '#00ff00' }), '#00ff00')
// Fijar "Nosotros" a mano tiene que arrastrar la interfaz automatica.
eq('la interfaz sigue a un nosotros elegido a mano',
   m.theme.hueDistance(m.theme.resolveChrome({ ...custom, ours: '#ff0000' }), '#ff0000') >= 175, true)

// --- hora compacta de la vista mes ---
const at = (h, mi) => { const d = new Date(2026, 8, 21); d.setHours(h, mi, 0, 0); return d }
eq('en punto sin minutos', m.dates.fmt.timeCompact(at(9, 0)), '9')
eq('en punto por la tarde', m.dates.fmt.timeCompact(at(21, 0)), '21')
eq('con minutos', m.dates.fmt.timeCompact(at(9, 30)), '9:30')
eq('minutos con cero', m.dates.fmt.timeCompact(at(13, 5)), '13:05')
eq('medianoche', m.dates.fmt.timeCompact(at(0, 0)), '0')

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
