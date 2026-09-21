# Nuestro calendario

PWA de calendario compartido para dos personas, sincronizada con Google Calendar.
Funciona en iPhone y Android instalándola en la pantalla de inicio.

No tiene servidor ni base de datos: **Google Calendar es la única fuente de
verdad**. La app habla directamente con la API de Google desde el navegador. Eso
significa que la sincronización es real y bidireccional sin mantenimiento —
si ella apunta una clase desde la app de Google, sale aquí, y al revés.

## Qué hace

- Tres calendarios en uno. **El nombre de cada uno es editable** («Rafa»,
  «Ana», «Los dos»…), y se puede quitar de la app o borrar de Google.
- **Cada uno marca cuál de los dos es él**, así en los dos móviles sale «Yo» en
  el calendario correcto (ver más abajo).
- **El nombre del calendario** también se cambia desde los ajustes.
- **Tema claro y oscuro** (o automático, siguiendo al móvil) y cuatro juegos de
  **color**: azul, rosa, verde o los que tú elijas. Cada uno lo configura en su
  cuenta y no afecta al otro.
- Saluda por el nombre de la cuenta con la que has entrado.
- Vistas de **mes** (con el nombre de cada evento), **semana**, **agenda** y
  **huecos**.
- **Huecos**: cruza los tres calendarios y enseña los ratos en los que nadie
  tiene nada, para saber cuándo podéis quedar. Al tocar uno se crea el evento ahí.
- Repeticiones con atajos (diaria, semanal, **semana sí / semana no**, mensual,
  anual) y un modo **personalizado**: cada N días/semanas/meses/años, en los
  días de la semana que elijas, y terminando nunca, en una fecha o tras N
  repeticiones.
- **Avisos** que llegan como notificación de Google Calendar al móvil.
- **Emoji propio** por evento, elegido de una lista o pegando el que quieras.
  Si no eliges ninguno se usa el de la etiqueta.
- **Etiquetas** (clase, trabajo, gym, médico, fisio, barbero, cena…). Tanto las
  etiquetas como el emoji se guardan al final de la descripción (`#etiqueta`,
  `[emoji:🍕]`), así que siguen ahí aunque edites el evento desde la app de
  Google.
- **Aniversarios** mensual y anual con corazón, creados con un botón desde los
  ajustes. El mensual salta noviembre, así el 22 de noviembre no salen los dos.
- Contador de días juntos desde el 22/11/2022.
- Se puede consultar sin conexión (lo último cargado). Para crear o editar hace
  falta red.

## Puesta en marcha

### 1. Crear las credenciales de Google (unos 10 minutos)

Esto hay que hacerlo con tu cuenta; no se puede automatizar.

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) y crea
   un proyecto (por ejemplo `calendario-pareja`).
2. **APIs y servicios → Biblioteca** → busca *Google Calendar API* → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**.
   - Rellena nombre de la app, tu correo de asistencia y tu correo de contacto.
   - En **Permisos**, añade los cuatro:
     `https://www.googleapis.com/auth/calendar`,
     `https://www.googleapis.com/auth/calendar.events`,
     `https://www.googleapis.com/auth/userinfo.profile` y
     `https://www.googleapis.com/auth/userinfo.email`.
     Los dos primeros son los del calendario; los de `userinfo` son para el
     nombre y la foto de la interfaz, y son permisos no sensibles.
   - En **Usuarios de prueba**, añade **tu correo y el suyo**.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes autorizados de JavaScript**: añade `http://localhost:5173` y,
     cuando despliegues, la URL de producción (por ejemplo
     `https://calendario-pareja.vercel.app`).
   - No hace falta URI de redirección: la app usa el flujo de token de Google
     Identity Services, que no redirige.
5. Copia el **ID de cliente** que te da.

> **Importante — el aviso de los 7 días.** Mientras la pantalla de consentimiento
> esté en modo *Prueba*, Google caduca el permiso cada 7 días y hay que volver a
> entrar. Para evitarlo, en la pantalla de consentimiento pulsa **Publicar
> aplicación**. Con los permisos de calendario Google marcará la app como *no
> verificada*: al entrar saldrá una pantalla de aviso en la que hay que pulsar
> *Configuración avanzada → Ir a (la app)*. Se acepta una vez y ya no molesta.
> No hace falta pasar ninguna revisión de Google para usarla vosotros dos.

### 2. Configurar el proyecto

```bash
cp .env.example .env.local
```

Abre `.env.local` y pega tu ID de cliente en `VITE_GOOGLE_CLIENT_ID`.

```bash
npm install
npm run dev
```

### 3. Conectar los calendarios

La primera vez, la app te pide asignar los tres calendarios. Puedes elegir
calendarios que ya tengas o pulsar **Crear** para que los haga ella.

Después, en cada uno, **Compartir…** te deja dar acceso a la otra cuenta:

- `Nosotros` → compartidlo con **permiso de edición** en las dos direcciones.
- Tu agenda y la suya → como prefiráis, *puede editar* o *solo ver*.

Cada uno entra en la app con **su propia cuenta de Google** y ve los tres
calendarios, porque los compartidos aparecen en su lista.

### 4. Aniversarios

En **Ajustes → Aniversarios**, el botón crea en «Nosotros» dos eventos que se
repiten solos: uno cada día 22 del mes y otro cada 22 de noviembre, los dos con
aviso. Si los pulsas dos veces no se duplican.

## Desplegar gratis

Con [Vercel](https://vercel.com) (plan gratuito, sin tarjeta):

```bash
npx vercel
```

Después, en el panel de Vercel, añade la variable de entorno
`VITE_GOOGLE_CLIENT_ID`, y acuérdate de **añadir la URL de producción a los
orígenes autorizados** del paso 1.4. Cualquier hosting estático sirve igual
(Netlify, Cloudflare Pages, GitHub Pages).

## Instalar en el móvil

- **iPhone**: abre la URL en Safari → Compartir → *Añadir a pantalla de inicio*.
  Tiene que ser Safari; desde Chrome no se instala.
- **Android**: Chrome ofrece *Instalar aplicación* solo.

Los avisos de los eventos llegan por la app de Google Calendar del móvil, no por
esta. Es a propósito: son más fiables que las notificaciones web, sobre todo en
iPhone.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve lo compilado |
| `npm test` | Pruebas de repeticiones, etiquetas, emoji, colores y huecos |
| `npm run typecheck` | Comprueba los tipos |

## Cómo está montado

```
src/
  lib/
    auth.ts          OAuth con Google Identity Services (sin servidor)
    gcal.ts          Llamadas a la API de Google Calendar
    model.ts         Evento de Google -> evento de la app
    eventWrite.ts    Crear, editar y borrar (instancia o serie entera)
    recurrence.ts    Construir y leer reglas RRULE
    tags.ts          Etiquetas dentro de la descripción
    freeSlots.ts     Cálculo de huecos libres
    dates.ts         Fechas y formatos en español
    theme.ts         Tema claro/oscuro, juegos de color y mezcla de tonos
    owners.ts        Quién es quién y nombre de cada carril
    labels.tsx       Los nombres, por contexto de React
    storage.ts       Ajustes por cuenta y copia sin conexión
    anniversaries.ts Aniversarios mensual y anual
    config.ts        Fecha de inicio, colores, permisos
  hooks/             Sesión, ajustes y carga de eventos
  components/        Vistas y formulario
```

### Sobre no tener que entrar todo el rato

Una app sin servidor tiene un techo aquí que conviene conocer: Google solo emite
tokens de **una hora** y no entrega *refresh token* a una aplicación que no
puede guardar un secreto. No hay forma de saltárselo sin montar un backend.

Lo que sí hace la app para que no se note:

1. Guarda el token en `localStorage`, así cerrar la app y volver a abrirla
   dentro de esa hora no pide nada.
2. Recuerda con qué cuenta entraste y se lo pasa a Google como `hint`, de modo
   que la renovación silenciosa acierta de cuenta sin preguntar, incluso con
   varias cuentas abiertas en el navegador.
3. Renueva en silencio al arrancar y cada vez que la API responde 401.

En la práctica el botón de Google solo reaparece si Google cierra su propia
sesión en ese navegador o si cierras sesión a mano. Si te pasa a menudo,
publica la app en https://console.cloud.google.com/auth/audience.

### Quién es quién

Los tres carriles (`mine`, `hers`, `ours`) son **fijos**: apuntan siempre a los
mismos calendarios de Google en los dos móviles. No son «el mío» y «el suyo»
según quién mire, porque entonces cada uno vería un calendario distinto bajo el
mismo nombre.

Por eso hay un ajuste, `me`, que dice cuál de los dos carriles personales es la
persona que ha entrado. Se marca con el botón **«Este soy yo»** en la pantalla
de calendarios, y de ahí salen:

- El nombre por defecto de cada carril: **«Yo»** para el tuyo, **«Mi pareja»**
  para el otro, **«Nosotros»** para el común. El mismo evento sale como «Yo» en
  un móvil y como «Mi pareja» en el otro.
- El nombre que propone el botón de crear calendario («Mi agenda» / «Su agenda»).

Como el ajuste se guarda **por cuenta de Google**, cada uno lo marca una vez en
su móvil y ya está. Si le pones nombre propio a un calendario («Rafa», «Ana»),
ese manda sobre el nombre por defecto.

### Los colores

Cada tema trae **tres colores de calendario**, y el tercero es la mezcla de los
dos primeros:

| Tema | Interfaz | Yo | Ella | Nosotros |
| --- | --- | --- | --- | --- |
| Azul | azul | rosa | lima | **ámbar** |
| Rosa | rosa | azul | amarillo | **verde** |
| Verde | verde | violeta | naranja | **rosa** |

Dos detalles que no son casuales:

- **El trío va en el lado opuesto del círculo cromático al color del tema.** El
  tema pinta la interfaz (botones, día de hoy, contador, pestaña activa) y el
  trío pinta los eventos. Si «Nosotros» fuera del color del tema no se
  distinguiría de la interfaz, así que se pone justo enfrente: en los tres
  temas, «Nosotros» queda a 180° de la interfaz y ninguna persona a menos de 60°.
- **Las dos personas quedan a 120-165° entre sí**, y además se separan en
  claridad. Es lo que hace que no se confundan ni en un bloque de 20 px de la
  vista de semana.

**Dentro de un tema** puedes elegir cuál de los dos colores quiere cada uno con
el botón **Intercambiar**: si te gusta más el que le ha tocado a ella, se
cambian.

Con el tema **«A mi gusto»** eliges los cuatro colores con el selector del
móvil: el tuyo, el suyo, el de «Nosotros» y el de la interfaz. Los dos últimos
vienen en automático y se pueden fijar a mano cuando quieras:

- **«Nosotros»** se calcula como la mezcla de los otros dos. La mezcla es **por
  tono, no por canales RGB** — la diferencia entre mezclar pintura y mezclar
  luz: en RGB, azul + amarillo da gris; por tono da verde, que es lo que espera
  cualquiera.
- **La interfaz** sale del opuesto a «Nosotros», que es lo que garantiza que no
  se parezca a ninguno de los tres del calendario.

La app avisa si los dos colores de persona quedan a menos de 45° entre sí, o si
el de la interfaz se acerca a menos de 40° de alguno del calendario: en los dos
casos dejarían de distinguirse.

### Decisiones que conviene conocer

- **En la vista de mes el evento sale con la hora y el nombre, sin emoji ni
  barra de color.** Una celda mide unos 48 px en un móvil, así que cada píxel
  cuenta: la hora va en formato mínimo («9», «9:30») y el fondo del chip ya dice
  de quién es. El emoji sí aparece en la semana, en la agenda y en el detalle
  del día.
- **Los colores** salen todos de fichas semánticas en `src/index.css`, que
  cambian según los atributos `data-theme`, `data-accent` y `data-swap` del
  `<html>`. Los componentes no llevan ni un color a mano: por eso cambiar de
  tema es instantáneo y no hay ninguna vista que se quede a medias.
- Cada tema define sus tres colores **sin dueño** (`--p1`, `--p2`, `--p3`), y un
  bloque aparte reparte quién se lleva cada uno. Así el botón de intercambiar es
  un atributo en el `<html>`, en vez de duplicar los seis bloques de colores.
- Los colores a medida se inyectan como variables (`--u-mine`, `--u-hers`,
  `--u-ours`, `--u-chrome`) y el CSS deriva de cada uno sus cuatro fichas con
  `color-mix`, en vez de pedir dieciséis colores al usuario.
- Los eventos se piden con `singleEvents=true`, así cada repetición llega ya
  expandida con su fecha. Google se encarga de interpretar las reglas.
- Al editar una repetición se puede tocar **solo ese día** o **toda la serie**.
  Si cambias la hora de toda la serie, se conserva la fecha de inicio original
  en lugar de moverla al día que estabas viendo.
- **Los ajustes se guardan por cuenta de Google.** Tema, colores, nombres,
  quién eres, calendarios y filtros son de cada uno, así que si alguna vez
  entráis los dos desde el mismo móvil no os pisáis.
- **Borrar un calendario de Google va detrás de dos confirmaciones** y avisa de
  que se lleva todos sus eventos, para los dos. «Quitarlo de la app» solo libera
  el hueco y no toca nada en Google.
- Lo único que se guarda en el móvil es eso más una copia de los eventos para
  poder consultarlos sin conexión. Se puede borrar desde los ajustes.
