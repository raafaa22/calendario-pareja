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

La primera vez sale un asistente que lo monta todo con **un solo dato: el
correo de tu pareja**. Funciona porque en Google **el ID del calendario
principal de una cuenta es su propio correo**, así que no hay que buscar nada en
ningún desplegable:

- **Tu calendario** → el de la cuenta con la que has entrado. Se detecta solo.
- **El de tu pareja** → su correo. Y si ya te ha compartido el suyo, **también
  se detecta solo**: su correo está a la vista en tu lista de calendarios,
  porque el ID de su principal *es* su correo. Sale rellenado con una etiqueta
  «detectado», y se puede cambiar.
- **El de los dos** → si tu pareja ya lo creó y te lo compartió, el asistente lo
  encuentra y lo reutiliza; si no, crea «Nosotros».

El asistente distingue un calendario de persona de uno de Google (grupos,
festivos, cumpleaños) por el ID: los de Google acaban en `calendar.google.com`.
Así no te ofrece los festivos de España como calendario conjunto ni confunde el
principal de tu pareja con el de los dos.

Al pulsar **Empezar**, la app comparte tu calendario y el conjunto con su correo.
Hay un interruptor para decidir si quieres que **pueda editar** tu calendario
(para apuntaros cosas el uno al otro) o solo verlo. El conjunto siempre es
editable por los dos.

Después ella hace lo mismo en su móvil. Como tú ya le has compartido los tuyos,
**en su móvil no tiene que escribir nada**: solo darle a Empezar. Se cierra el
círculo:

| | En tu móvil | En el de ella |
| --- | --- | --- |
| «Yo» | tu correo | su correo |
| «Mi pareja» | su correo | tu correo |
| «Nosotros» | el mismo calendario en los dos | |

> La primera vez que lo montes, el asistente te avisará de que ella **aún no ha
> compartido su calendario contigo**. Es normal y no hay que hacer nada: en
> cuanto ella entre en la app y ponga tu correo, sus eventos empiezan a
> aparecer en tu móvil solos, sin tocar nada.

Si prefieres hacerlo a mano, o cambiar algo después, **Ajustes → Los
calendarios** deja elegir otros calendarios, crear nuevos, renombrarlos,
compartirlos y quitarlos.

**Ajustes** está repartido en secciones, cada una en su pantalla, con una flecha
para volver en la cabecera: *Los calendarios*, *Aspecto*, *La vista de mes*,
*Aniversarios*, *Avisos por defecto* y *Nombre y datos*. Cada fila del menú
enseña en qué está ahora mismo, para no tener que entrar a mirar.

> **La configuración se guarda en cada dispositivo, no en la cuenta.** Si lo
> montas en el ordenador, el móvil seguirá con lo que tuviera (o sin nada). Para
> eso está **Ajustes → ¿Apunta a los calendarios que no son? → Volver a la
> configuración guiada**: vacía el reparto de este dispositivo y lanza el
> asistente otra vez. No toca nada en Google.

Al elegir el calendario conjunto, el asistente preselecciona el que mejor pinta
tiene: primero uno que te haya compartido otra persona, y si no, por el nombre
(«Nosotros», «Los dos», «Pareja»…). Si hay empate no preselecciona ninguno y
avisa, porque dar por bueno lo que ya viene puesto es justo como acaban dos
calendarios conjuntos distintos. Y si te han compartido uno pero no te aparece en la
lista (pasa cuando Google se queda esperando que aceptes la invitación por
correo), el enlace **«No me sale en la lista…»** lo añade pegando su ID.

### 4. Aniversarios

En **Ajustes → Aniversarios**, el botón pone en el calendario conjunto dos
eventos que se repiten solos: uno cada día 22 del mes y otro cada 22 de
noviembre. El mensual salta noviembre, así ese día no salen los dos.

En Google se llaman **🐣❤️** a secas. La cuenta de meses y años **no se guarda
en el evento**: la pone la app al pintarlo, calculada por la fecha de cada
repetición.

| | |
| --- | --- |
| Guardado en Google | `🐣❤️` · `🐣❤️` · `🐣❤️` |
| Como se ve en la app | `🐣❤️ 3 años y 10 meses` · `🐣❤️ 3 años y 11 meses` · `🐣❤️ 4 años` |

Es la única forma de que un evento recurrente lleve la cuenta: una serie tiene
un único nombre para todas sus repeticiones. La alternativa sería un evento
suelto por fecha, y eso hay que ir alargándolo cada pocos años; estos no caducan
nunca.

Por eso `AppEvent` tiene dos títulos: `title` es el que está en Google y el que
edita y guarda el formulario, y `displayTitle` el que pintan las vistas. Si se
usara el mismo, al abrir un aniversario y darle a guardar se grabaría el número
dentro del evento y se rompería para todas las demás repeticiones.

Pulsarlo otra vez no duplica nada: reconoce lo que ya está, corrige la regla si
quedó de una versión anterior, y borra los restos (series antiguas, o los
eventos sueltos con la cuenta que probó una versión intermedia).

### 5. Limpieza

**Ajustes → Limpieza** tiene las dos cosas destructivas, juntas y apartadas:

- **Los aniversarios** — borra los que haya puesto la app, de esta versión y de
  las anteriores. Va **por el nombre del evento**, así que un evento tuyo
  etiquetado como aniversario no se toca. Se pueden volver a poner cuando
  quieras.
- **Calendarios sueltos** — los que son tuyos y la app no usa: restos de
  pruebas o de configuraciones anteriores. Tu calendario principal, los tres en
  uso y los que no son tuyos no aparecen. Va con casillas y una confirmación
  que dice exactamente qué se pierde, porque borrar un calendario de Google se
  lleva sus eventos para siempre y para todos los que lo tengan compartido.

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
    calendarGuess.ts Detectar el correo de la pareja y el calendario conjunto
    labels.tsx       Los nombres, por contexto de React
    storage.ts       Ajustes por cuenta y copia sin conexión
    anniversaries.ts Aniversarios mensual y anual
    config.ts        Fecha de inicio, colores, permisos
  hooks/             Sesión, ajustes y carga de eventos
  components/        Vistas, formulario y el asistente de la primera vez
```

### Sobre la sesión

Esto tiene un techo real, y conviene conocerlo antes de que sorprenda:

1. **Google solo emite tokens de una hora** y no entrega *refresh token* a una
   aplicación que no puede guardar un secreto. Sin backend no hay forma de
   saltárselo.
2. **El cliente de tokens de Google funciona con una ventana emergente**, y una
   emergente que no nace de un toque del usuario la bloquea el navegador. No
   existe un modo silencioso de verdad.

Por eso la app **no intenta renovar por su cuenta**. Lo que hace:

- Guarda el token en `localStorage`, así cerrar la app y volver a abrirla dentro
  de esa hora no pide nada.
- Recuerda con qué cuenta entraste, para dirigir el siguiente acceso a esa
  cuenta (`hint`) y poder saludarte por tu nombre.
- Cuando el token caduca, vuelve a la pantalla de entrada. **Un toque**, sin
  elegir cuenta ni volver a dar permisos, porque Google ya los recuerda.

En la práctica: si usas la app varias veces al día, casi nunca verás el botón;
si la abres una vez cada mañana, tocarás «Entrar como…» una vez y listo.

> Un aviso por si alguna vez se toca este código: **llamar al cliente de tokens
> al arrancar no funciona.** Intenta abrir la emergente, el navegador la bloquea
> y tarda unos 6 segundos en rendirse, con la app parada en la pantalla de carga
> todo ese rato. Fue exactamente el fallo que tuvo la primera versión.

Si algún día molesta ese toque, el arreglo de verdad es cambiar a **redirección
de página completa con `prompt=none`**: Google devuelve un token nuevo sin
ninguna interacción. Cuesta registrar una URI de redirección en Google Cloud y
reescribir `src/lib/auth.ts`.

### Quién es quién

Los tres carriles (`mine`, `hers`, `ours`) son **fijos**: apuntan siempre a los
mismos calendarios de Google en los dos móviles. No son «el mío» y «el suyo»
según quién mire, porque entonces cada uno vería un calendario distinto bajo el
mismo nombre.

Por eso hay un ajuste, `me`, que dice cuál de los dos carriles personales es la
persona que ha entrado. El asistente de la primera vez lo pone solo (`mine` es
siempre el de quien entra), y se puede cambiar con el botón **«Este soy yo»** en
la pantalla de calendarios. De ahí salen:

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

- **En la vista de mes cabe poco, y se elige qué cabe.** Una celda mide unos
  48 px en un móvil: descontando borde y relleno quedan ~42 px, que a 8 px de
  letra son unas 10 letras. La hora gasta 2 o 3 y el emoji otros 2 o 3, así que
  en **Ajustes → La vista de mes** se activa o desactiva cada uno, con una vista
  previa al lado:

  | Ajuste | Cómo queda |
  | --- | --- |
  | Hora (por defecto) | `8 Clases`, `9 Trabajo` |
  | Emoji | `📚 Clas…` |
  | Los dos | `📚 8 Cl…` |

  La hora va en formato mínimo («9», «9:30»), y ni el emoji ni una barra de
  color hacen falta para saber de quién es: el fondo del chip ya lo dice. En la
  semana, en la agenda y en el detalle del día sí sale siempre el emoji.
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
