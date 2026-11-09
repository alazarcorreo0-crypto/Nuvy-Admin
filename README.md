# Nuvy Admin

Aplicación para llevar el control de un negocio de **nieve por peso**: insumos, compras, ventas del día, gastos, conteo físico del inventario y **corte semanal con ganancia real**.

Funciona como una app instalable en el teléfono (PWA), sin cuentas ni contraseñas. Los datos se pueden compartir entre varios teléfonos usando un **código de familia**.

---

## Índice

1. [Qué hace la app](#qué-hace-la-app)
2. [Cómo se calcula el corte semanal](#cómo-se-calcula-el-corte-semanal)
3. [Ejemplo de éxito (para comprobar que todo funciona)](#ejemplo-de-éxito-para-comprobar-que-todo-funciona)
4. [Publicar la app en GitHub Pages](#publicar-la-app-en-github-pages)
5. [Activar la sincronización con Firebase](#activar-la-sincronización-con-firebase)
6. [Compartir con la familia y usar varios teléfonos](#compartir-con-la-familia-y-usar-varios-teléfonos)
7. [Instalar la app en el teléfono](#instalar-la-app-en-el-teléfono)
8. [Uso diario recomendado](#uso-diario-recomendado)
9. [Modo local y modo nube](#modo-local-y-modo-nube)
10. [Seguridad y respaldos](#seguridad-y-respaldos)
11. [Problemas frecuentes](#problemas-frecuentes)
12. [Actualizar la app](#actualizar-la-app)
13. [Para quien programa (apéndice)](#para-quien-programa-apéndice)

---

## Qué hace la app

La app tiene estas pantallas:

| Pantalla | Para qué sirve |
| --- | --- |
| **Inicio** | Resumen del día y de la semana, accesos rápidos. |
| **Ventas** | Registrar el total vendido del día (solo fecha y monto). |
| **Gastos** | Sueldos, renta, luz, agua, gas, etc. |
| **Compras** | Insumos que entran al inventario, con su costo. |
| **Inventario** | Conteo físico de lo que queda y estimación del inventario actual. |
| **Insumos** | Catálogo: base de nieve, toppings secos y líquidos, con su precio. |
| **Corte semanal** | Consumo, costo del consumo, ganancia real y compra sugerida. |
| **Ajustes** | Código de familia, enlace para compartir, sincronización e instalación. |

Reglas importantes del negocio:

- **El inventario solo cambia con compras y conteos físicos.** Las ventas **nunca** descuentan gramos automáticamente.
- El consumo real se obtiene con los conteos físicos, no con lo que “debería” haberse vendido.
- La semana del negocio va de **sábado a viernes**.
- La zona horaria del negocio es **America/Mexico_City**, aunque el teléfono esté en otro país.
- Los costos se valorizan con el **costo promedio ponderado** de las compras.

---

## Cómo se calcula el corte semanal

Para cada insumo, dentro de la semana de sábado a viernes:

```text
Consumo = inventario inicial + compras de la semana − inventario final
```

- **Inventario inicial:** el último conteo registrado **en o antes del sábado** de esa semana.
- **Inventario final:** el último conteo registrado **después del sábado y hasta el viernes**.
- **Compras de la semana:** todas las compras con fecha dentro de la semana.
- **Costo del consumo:** `consumo × costo promedio por gramo o mililitro`.
- **Costo promedio ponderado:** `total pagado en todas las compras hasta la fecha ÷ total de gramos o mililitros comprados`. Si todavía no hay compras, se usa el precio del catálogo.
- **Ganancia real:** `ventas de la semana − gastos de la semana − costo del insumo consumido`.
- **Compra sugerida:** `consumo de la semana ÷ contenido de una unidad de compra`.
  - Bolsas y piezas se redondean **hacia arriba** (no se compran fracciones).
  - Kilogramos y litros se redondean **hacia arriba a 2 decimales**.

El corte también avisa cuando:

- Falta el conteo final de un insumo.
- Hay una compra **después** del último conteo (el conteo quedó viejo).
- No hay conteo inicial y se asumió 0.
- El conteo final es mayor que el inventario inicial más las compras.

La app maneja **varios conteos y varias compras dentro de la misma semana**, incluso un conteo en cero a media semana seguido de una compra nueva. Para el corte toma el conteo más reciente antes del sábado y el más reciente del resto de la semana.

---

## Ejemplo de éxito (para comprobar que todo funciona)

Este ejemplo se puede capturar en la app y debe dar exactamente estos resultados. La semana es **sábado 7 al viernes 13 de noviembre de 2026**.

### Insumos

| Insumo | Tipo | Unidad de compra | Contenido | Precio actual |
| --- | --- | --- | --- | --- |
| Base de nieve | Base de nieve | bolsa | 5,000 g | $200 |
| Nuez | Topping seco | kg | 1,000 g | $300 |

### Movimientos de la semana

| Fecha | Movimiento | Detalle |
| --- | --- | --- |
| 07/11/2026 | Conteo inicial | Base: 3,000 g · Nuez: 1,000 g |
| 09/11/2026 | Compra | Base: 1 bolsa (5,000 g) por $200 |
| 09/11/2026 | Compra | Nuez: 1 kg (1,000 g) por $300 |
| 10/11/2026 | Venta | $5,000 |
| 11/11/2026 | Gasto | $1,000 |
| 13/11/2026 | Conteo final | Base: 6,000 g · Nuez: 1,600 g |

### Resultado esperado

| Insumo | Consumo | Costo del consumo |
| --- | --- | --- |
| Base de nieve | **2,000 g** | **$80** |
| Nuez | **400 g** | **$120** |

- Costo total del insumo consumido: **$200**
- Ganancia real: **$3,800** (`$5,000 − $1,000 − $200`)
- Compra sugerida:
  - Base de nieve: **1 bolsa**
  - Nuez: **0.4 kg**

> **Nota:** para ver este ejemplo en el corte, selecciona una fecha dentro de esa semana (por ejemplo, 09/11/2026) en la pantalla **Corte semanal**. La app usa la semana completa, no solo el día elegido.

---

## Publicar la app en GitHub Pages

La app es 100 % estática: no necesita servidor, base de datos propia ni instalar programas. GitHub Pages la publica gratis.

> **Importante:** GitHub Pages gratis requiere un repositorio **público**. El código de la app puede ser público; tus datos del negocio van en Firebase, no en GitHub.

### Paso 1. Crear una cuenta de GitHub

1. Entra a <https://github.com> y crea una cuenta gratuita.
2. Confirma tu correo.

### Paso 2. Crear el repositorio

1. Arriba a la derecha, toca **+** → **New repository**.
2. Nombre sugerido: `nuvy-admin`.
3. Marca **Public**.
4. **No** marques “Add a README file” (ya tienes uno).
5. Toca **Create repository**.

### Paso 3. Subir los archivos

La forma más sencilla, sin instalar nada:

1. En el repositorio vacío, toca **uploading an existing file** (o **Add file** → **Upload files**).
2. Arrastra **todo el contenido** de la carpeta del proyecto. Deben quedar en la raíz del repositorio:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `firestore.rules`
   - la carpeta `css/`
   - la carpeta `js/`
   - la carpeta `icons/`
   - la carpeta `vendor/`
3. Escribe un mensaje como “Primera versión” y toca **Commit changes**.

> No subas la carpeta contenedora completa si eso deja los archivos dentro de otra carpeta. `index.html` debe quedar en la **raíz** del repositorio.

### Paso 4. Activar GitHub Pages

1. Entra a **Settings** (Configuración) del repositorio.
2. En el menú izquierdo, toca **Pages**.
3. En **Build and deployment** → **Source**, elige **Deploy from a branch**.
4. En **Branch**, elige `main` y la carpeta `/ (root)`.
5. Toca **Save**.
6. Espera de 1 a 3 minutos. GitHub mostrará un enlace parecido a:

   ```text
   https://TU-USUARIO.github.io/nuvy-admin/
   ```

7. Abre ese enlace en el teléfono. Debe aparecer la pantalla de bienvenida de Nuvy Admin.

> Si ves un error 404, revisa que `index.html` esté en la raíz y que Pages esté en la rama `main`, carpeta `/ (root)`.

---

## Activar la sincronización con Firebase

Sin Firebase, la app funciona completa pero **solo en un teléfono**. Firebase permite que varios teléfonos vean y editen los mismos datos en tiempo real, incluso estando en países distintos.

Firebase tiene un plan gratuito (Spark) suficiente para este uso. No se necesita tarjeta.

### Paso 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. Toca **Agregar proyecto** / **Create a project**.
3. Nombre sugerido: `nuvy-admin` (o el que quieras).
4. Puedes desactivar Google Analytics; no hace falta.
5. Toca **Crear proyecto** y espera.

### Paso 2. Activar Firestore

1. En el menú izquierdo, toca **Compilación** → **Firestore Database**.
2. Toca **Crear base de datos**.
3. Elige una ubicación cercana (por ejemplo, `us-central` o `northamerica-south1`). **No se puede cambiar después**, pero cualquiera funciona.
4. En reglas iniciales, elige **Modo de producción** (las reglas correctas se publican en el paso 4).
5. Toca **Crear**.

### Paso 3. Registrar la app web y copiar la configuración

1. En la página principal del proyecto, toca el ícono **Web** (`</>`).
2. Apodo de la app: `Nuvy Admin`.
3. **No** marques Firebase Hosting.
4. Toca **Registrar app**.
5. Firebase muestra un bloque parecido a este:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "nuvy-admin.firebaseapp.com",
     projectId: "nuvy-admin",
     storageBucket: "nuvy-admin.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   };
   ```

6. Copia **todo ese bloque**. Lo usarás en el paso 5.

### Paso 4. Publicar las reglas de seguridad

El proyecto incluye el archivo `firestore.rules` con las reglas que la app necesita.

1. En Firebase, entra a **Firestore Database** → pestaña **Reglas**.
2. Abre el archivo `firestore.rules` de este proyecto con cualquier editor de texto (Bloc de notas sirve).
3. Copia **todo** su contenido y pégalo en el editor de reglas de Firebase, reemplazando lo que haya.
4. Toca **Publicar**.

Las reglas permiten leer y escribir solamente dentro de:

```text
families/{código-de-familia}/records/{registro}
```

y dejan cerrado todo lo demás.

### Paso 5. Conectar la app con Firebase

Tienes dos opciones. La **Opción A** es la más recomendada para la familia.

#### Opción A: dejar la configuración dentro del proyecto (recomendada)

Así todos los teléfonos se conectan solos y el enlace para compartir solo lleva el código de familia.

1. Abre el archivo `js/config.js`.
2. Busca esta línea:

   ```js
   firebase: null,
   ```

3. Reemplázala por el objeto que copiaste de Firebase. Debe quedar así (con tus propios valores):

   ```js
   firebase: {
     apiKey: "AIza...",
     authDomain: "nuvy-admin.firebaseapp.com",
     projectId: "nuvy-admin",
     storageBucket: "nuvy-admin.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   },
   ```

4. Guarda el archivo y vuelve a subirlo a GitHub (reemplazando el anterior).
5. Espera un minuto y recarga la app.

#### Opción B: pegarla desde la app (sin editar archivos)

1. Abre la app y crea tu código de familia.
2. Ve a **Ajustes** → **Firebase**.
3. Pega el bloque completo que copiaste de Firebase. Se acepta tal cual, con o sin `const firebaseConfig =`.
4. Toca **Guardar y conectar**.
5. La app se recargará y quedará en modo nube.
6. En **Ajustes**, toca **Copiar enlace**. Ese enlace ya incluye la configuración y el código de familia; mándalo a los demás teléfonos.

> La Opción B guarda la configuración en ese teléfono y dentro del enlace para compartir. Si borras los datos del navegador, tendrás que volver a pegar la configuración o usar la Opción A.

### Comprobar que la nube funciona

En **Ajustes** → **Sincronización** debe decir **Nube compartida** y **Sincronizado**. En la barra superior aparece una etiqueta verde.

Si dice **Solo este dispositivo**, revisa:

- Que guardaste bien la configuración (sin comas faltantes).
- Que publicaste las reglas de Firestore.
- Que el teléfono tiene internet.

---

## Compartir con la familia y usar varios teléfonos

La app no usa cuentas ni contraseñas. El **código de familia** es el espacio compartido: todos los teléfonos que usen el mismo código ven los mismos datos.

### Crear el código en el primer teléfono

1. Abre la app publicada.
2. Toca **Crear un código nuevo**.
3. La app genera un código parecido a `NUVY-ABCD-2345`.
4. Anótalo o compártelo.

### Agregar otro teléfono

La forma más fácil:

1. En el primer teléfono, ve a **Ajustes**.
2. Toca **Copiar enlace** (o **Enviar por WhatsApp**).
3. Abre el enlace en el segundo teléfono.
4. El segundo teléfono queda configurado con el mismo código de familia y la misma nube.
5. Instala la app en ese teléfono (ver siguiente sección).

También puedes tocar **Ya tengo un código** en la pantalla de bienvenida y escribirlo a mano. No importan las mayúsculas ni los espacios.

### Qué pasa cuando dos teléfonos editan

- Con Firebase, los cambios aparecen en los demás teléfonos en tiempo real.
- Sin internet, cada teléfono sigue funcionando y guarda los cambios.
- Al volver la conexión, Firestore sube los cambios pendientes.
- Si un teléfono trabajó en modo local porque la nube no estaba disponible, al reconectarse la app sube esos registros antes de seguir en la nube.

### Cambiar de familia

En **Ajustes** → **Compartir con la familia** → **Usar otro código de familia**. Los datos de la familia anterior **no se borran**.

---

## Instalar la app en el teléfono

La app debe abrirse desde el enlace de GitHub Pages (HTTPS). No la abras como archivo local si quieres instalar y usar la nube.

### Android (Chrome, Edge, Samsung Internet)

1. Abre el enlace de la app.
2. Toca el menú **⋮**.
3. Elige **Instalar aplicación** o **Agregar a pantalla de inicio**.
4. Confirma.

También puede aparecer un aviso dentro de la app con el botón **Instalar Nuvy Admin**.

### iPhone / iPad (Safari)

1. Abre el enlace **en Safari** (no en Chrome).
2. Toca el botón **Compartir** (cuadrado con flecha).
3. Baja y toca **Añadir a pantalla de inicio**.
4. Toca **Agregar**.

### Después de instalar

- Ábrela desde el ícono, como cualquier app.
- Se abre sin barra de direcciones.
- Funciona sin internet y se sincroniza al volver la conexión.

---

## Uso diario recomendado

### Todos los días

1. **Ventas:** al terminar el día, registra el total vendido.
2. **Gastos:** registra sueldos, luz, renta y cualquier gasto que no sea compra de insumos.

### Cada vez que compres insumos

1. Ve a **Compras**.
2. Elige el insumo, la cantidad comprada y el total pagado.
3. La app convierte automáticamente a gramos o mililitros y actualiza el costo promedio.
   - Los toppings líquidos se pueden comprar **por litro o por kilogramo**. Para el cálculo, la app toma 1 litro o 1 kg como 1,000 ml.

### Los viernes (o cuando cierres la semana)

1. Ve a **Inventario**.
2. Cuenta físicamente cada insumo.
3. Registra lo que queda. Puedes capturar en g, kg, bolsas, piezas, ml o L.
4. Si un insumo se acabó a media semana:
   - Registra un conteo en **0**.
   - Registra la compra nueva.
   - Al viernes, registra el conteo final.
5. Ve a **Corte semanal** y revisa:
   - Consumo por insumo.
   - Costo del consumo.
   - Ganancia real.
   - Compra sugerida para la próxima semana.

### El sábado

- Empieza la nueva semana.
- El conteo del viernes se convierte en el inventario inicial de la semana que empieza, siempre que lo hayas registrado con la fecha correcta.

---

## Modo local y modo nube

### Modo local

- Se usa cuando Firebase todavía no está configurado o cuando la nube no está disponible.
- Los datos se guardan **solamente en ese teléfono** (en el almacenamiento del navegador).
- La app funciona completa: insumos, compras, ventas, gastos, conteos y corte.
- En **Ajustes** aparece **Solo este dispositivo**.

### Modo nube

- Se usa cuando Firebase está configurado y hay conexión.
- Los datos se guardan en Firestore y se comparten entre teléfonos con el mismo código de familia.
- La app mantiene una copia local para seguir funcionando sin internet.
- En **Ajustes** aparece **Nube compartida**.

### Si la nube falla

La app no se queda bloqueada:

- Si hay datos guardados en el teléfono, sigue trabajando con ellos.
- Muestra un aviso y permite reintentar la conexión.
- Al volver internet, intenta reconectar y subir lo que se haya capturado.

### Pasar de local a nube

Si empezaste en modo local y después configuras Firebase:

1. La app guarda los registros locales como “pendientes de subir”.
2. Al conectar la nube, los sube automáticamente.
3. Si la subida falla, lo vuelve a intentar al abrir la app.

---

## Seguridad y respaldos

### Sobre el código de familia

El código de familia **no es una contraseña**. Es un espacio compartido:

- Cualquier persona que tenga el código o el enlace puede **ver y editar** los datos de esa familia.
- Compártelo solamente con personas de confianza.
- No lo publiques en redes sociales ni en lugares públicos.
- Si sospechas que alguien más lo tiene, crea una familia nueva y vuelve a capturar o migrar lo necesario. (La app no tiene “expulsar usuarios” porque no hay cuentas.)

### Sobre las reglas de Firebase

El archivo `firestore.rules` limita el acceso a la ruta de cada familia, pero **no verifica identidad**. La seguridad real depende de que el código se mantenga privado.

### Respaldos

- **Modo nube:** los datos están en Firestore. Puedes exportarlos desde Firebase Console → Firestore Database → **Exportar** (requiere un bucket de Cloud Storage; es un paso técnico).
- **Modo local:** los datos viven en el navegador del teléfono. Si borras los datos del navegador, se pierden. Para respaldar, configura Firebase y deja que la app suba los registros.
- No borres la app del teléfono pensando que los datos están “en la app”: en modo local, se borran con los datos del navegador.

### Privacidad

- No se piden nombres, correos ni contraseñas.
- No hay analítica ni publicidad.
- Los datos se guardan en el dispositivo y, si configuras Firebase, en tu proyecto de Firebase.

---

## Problemas frecuentes

### La app abre, pero no aparece el botón de instalar

- En Android, usa Chrome o Edge y espera unos segundos; el aviso de instalación puede tardar.
- En iPhone, la instalación se hace desde **Safari** → **Compartir** → **Añadir a pantalla de inicio**. No hay botón automático.
- Asegúrate de abrir la app desde HTTPS (GitHub Pages), no desde un archivo local.

### Dice “Solo este dispositivo” y no sincroniza

1. Revisa que la configuración de Firebase esté guardada (Ajustes → Firebase).
2. Revisa que hayas publicado las reglas de `firestore.rules`.
3. Revisa el internet del teléfono.
4. Toca **Reintentar conexión** en Ajustes.

### Firebase dice “permission-denied”

- Las reglas de Firestore no están publicadas o no coinciden.
- Vuelve a copiar `firestore.rules` completo en Firebase Console → Firestore Database → Reglas → Publicar.

### El otro teléfono no ve los mismos datos

- Verifica que los dos teléfonos tengan **exactamente el mismo código de familia**. Puedes verlo en la barra superior o en Ajustes.
- Si uno está en modo local, no verá los datos de la nube hasta configurar Firebase.
- Abre el enlace de compartir en el segundo teléfono para configurarlo automáticamente.

### El corte dice “Falta conteo final”

- Falta registrar el conteo del viernes para ese insumo.
- O hay una compra registrada **después** del último conteo. Registra un conteo nuevo después de esa compra.

### El corte dice “No hay conteo inicial”

- No hay ningún conteo con fecha en o antes del sábado de esa semana.
- La app asumió 0. Si ya tenías inventario, registra un conteo con la fecha de inicio de la semana.

### El consumo sale negativo

- El conteo final es mayor que el inventario inicial más las compras.
- Revisa que hayas capturado bien las cantidades y las fechas.
- Recuerda que las ventas **no** descuentan inventario; el consumo se calcula con conteos.

### Los números no coinciden con lo que esperaba

- Revisa la **fecha** de cada movimiento: la semana es sábado a viernes.
- Revisa la **unidad** del conteo (g, kg, bolsas, piezas, ml, L).
- Revisa el **contenido por unidad** del insumo (por ejemplo, cuántos gramos trae una bolsa).
- Revisa si hay compras con fecha posterior al conteo final.

### Cambié un archivo y no veo el cambio

- GitHub Pages tarda de 1 a 3 minutos en publicar.
- El service worker guarda una copia para funcionar sin internet. Cierra y vuelve a abrir la app, o recarga dos veces.
- Si el cambio es importante, sube el número `VERSION` en `sw.js` (por ejemplo, de `nuvy-admin-v1.0.0` a `nuvy-admin-v1.0.1`) antes de publicar.

### Quiero empezar de cero en un teléfono

- En **Ajustes** puedes cambiar de código de familia.
- Para borrar los datos locales de un código, borra los datos del sitio desde la configuración del navegador. **Esto no borra los datos de Firebase**, solo la copia de ese teléfono.
- Para borrar los datos de la nube, hazlo desde Firebase Console → Firestore Database.

---

## Actualizar la app

1. Descarga o prepara los archivos nuevos.
2. Si cambiaste archivos importantes, sube el número `VERSION` en `sw.js`.
3. En GitHub, entra al repositorio y sube los archivos reemplazando los anteriores (**Add file** → **Upload files**, o edita el archivo directamente).
4. Espera de 1 a 3 minutos.
5. Abre la app y recárgala. Si no ves el cambio, ciérrala y ábrela de nuevo.

Los datos **no se pierden** al actualizar: están en Firebase (modo nube) o en el almacenamiento del teléfono (modo local).

---

## Para quien programa (apéndice)

### Estructura

```text
index.html                 Estructura de la app
manifest.json              Manifest PWA
sw.js                      Service worker (offline y actualizaciones)
firestore.rules            Reglas de Firestore
css/styles.css             Estilos
icons/                     Íconos 192, 512, maskable y Apple
js/
  app.js                   Arranque, rutas, onboarding, modo local/nube
  config.js                Configuración de Firebase y zona horaria
  core/
    dates.js               Fechas y semana sábado-viernes
    format.js              Formatos de moneda y números
    units.js               Unidades y conversiones (g, kg, ml, L, bolsa, pieza)
    validation.js          Validación de formularios
    inventory.js           Conteos, compras y costo promedio ponderado
    weekly-cut.js          Cálculo del corte semanal
  services/
    settings-store.js      Código de familia, configuración y enlaces
    local-adapter.js       Almacenamiento local y sincronización entre pestañas
    firestore-adapter.js   Firestore con caché offline y tiempo real
    store.js               API central de datos
  ui/                      Componentes e íconos
  views/                   Pantallas
tests/weekly-cut.test.js   Pruebas del cálculo semanal
vendor/firebase/           SDK de Firebase 10.14.1 incluido localmente
scripts/check-syntax.mjs   Revisión de sintaxis
```

### Datos

Todos los registros viven en una sola colección por familia:

```text
families/{familyCode}/records/{recordId}
```

Cada registro tiene `kind`:

- `supply` — insumo del catálogo
- `purchase` — compra de insumo
- `sale` — venta del día
- `expense` — gasto
- `count` — conteo físico

Campos comunes: `id`, `kind`, `createdAt`, `updatedAt`, `schemaVersion`.

### Modo local

- `localStorage`, clave `nuvy.data.{CODIGO}`.
- Sincronización entre pestañas con `BroadcastChannel` y el evento `storage`.
- No requiere cargar el SDK de Firebase.

### Modo nube

- Firestore con `persistentLocalCache` y `persistentMultipleTabManager`.
- Escucha en tiempo real con `onSnapshot`.
- Sin Firebase Auth: el código de familia es el espacio compartido.
- La configuración de `js/config.js` tiene prioridad sobre la guardada desde Ajustes.

### Enlaces de configuración

- `?familia=CODIGO` — entra con un código de familia.
- `?nuvy=<base64>` — incluye código de familia y configuración de Firebase. Se usa cuando la configuración no está en `js/config.js`.

### Desarrollo local

Requisitos: Node.js 18+ y Python (para el servidor local).

```bash
npm test          # pruebas del corte semanal
npm run check     # revisión de sintaxis
npm run serve     # servidor local en http://localhost:8080
```

> El service worker y la instalación PWA requieren HTTPS o `localhost`. Abrir `index.html` como archivo (`file://`) no activa el modo offline.

### Publicación

Cualquier hosting estático sirve (GitHub Pages, Netlify, Cloudflare Pages). No hay paso de compilación: se suben los archivos tal cual.

---

Hecho para que el negocio sepa **cuánto ganó de verdad**, no solo cuánto vendió.
