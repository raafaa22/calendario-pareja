# Nuestro calendario

PWA de calendario compartido para dos personas, sincronizada con Google Calendar.
Funciona en iPhone y Android instalándola en la pantalla de inicio.

No tiene servidor ni base de datos: **Google Calendar es la única fuente de
verdad**. La app habla directamente con la API de Google desde el navegador. Eso
significa que la sincronización es real y bidireccional sin mantenimiento —
si ella apunta una clase desde la app de Google, sale aquí, y al revés.

## Qué hace

- Tres calendarios en uno: **Yo** (azul), **Ella** (verde) y **Nosotros** (turquesa).
- **Tema claro y oscuro** (o automático, siguiendo al móvil) y **color de acento**
  a elegir entre azul, rosa y verde. Cada uno lo elige en su cuenta y no afecta
  al otro; el color de cada persona en los eventos no cambia, para que los dos
  veáis el mismo color para la misma persona.
- Saluda por el nombre de la cuenta con la que has entrado.
- Vistas de **mes**, **semana**, **agenda** y **huecos**.
- **Huecos**: cruza los tres calendarios y enseña los ratos en los que nadie
  tiene nada, para saber cuándo podéis quedar. Al tocar uno se crea el evento ahí.
- Repeticiones: diaria, semanal, **semana sí / semana no** (para las prácticas),
  mensual y anual, con días de la semana concretos y fecha de fin.
- **Avisos** que llegan como notificación de Google Calendar al móvil.
- **Etiquetas** (clase, trabajo, gym, médico, fisio, barbero, cena…) que pintan
  un icono en cada evento. Se guardan como `#etiqueta` al final de la descripción,
  así que siguen ahí aunque edites el evento desde la app de Google.
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
| `npm test` | Pruebas de repeticiones, etiquetas y huecos |
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
    theme.ts         Tema claro/oscuro y color de acento
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

### Decisiones que conviene conocer

- **Los colores** salen todos de fichas semánticas en `src/index.css`, que
  cambian según los atributos `data-theme` y `data-accent` del `<html>`. Los
  componentes no llevan ni un color a mano: por eso cambiar de tema es
  instantáneo y no hay ninguna vista que se quede a medias.
- Los eventos se piden con `singleEvents=true`, así cada repetición llega ya
  expandida con su fecha. Google se encarga de interpretar las reglas.
- Al editar una repetición se puede tocar **solo ese día** o **toda la serie**.
  Si cambias la hora de toda la serie, se conserva la fecha de inicio original
  en lugar de moverla al día que estabas viendo.
- **Los ajustes se guardan por cuenta de Google.** Tema, acento, calendarios y
  filtros son de cada uno, así que si alguna vez entráis los dos desde el mismo
  móvil no os pisáis.
- Lo único que se guarda en el móvil es eso más una copia de los eventos para
  poder consultarlos sin conexión. Se puede borrar desde los ajustes.
