# Nuvy Admin

Aplicación para llevar el control de un negocio de **nieve por peso**: insumos, compras, ventas del día, gastos, conteo físico del inventario, **corte semanal con ganancia real**, **corte mensual**, control de la caja (cierres y retiros) y **respaldo de tus datos en un archivo**.

Funciona como una app instalable en el teléfono (PWA), sin cuentas ni contraseñas. Los datos se pueden compartir entre varios teléfonos usando un **código de familia**.

---

## Índice

1. [Qué hace la app](#qué-hace-la-app)
2. [El dinero de la caja y la ganancia no son lo mismo](#el-dinero-de-la-caja-y-la-ganancia-no-son-lo-mismo)
3. [Cómo se calcula el corte semanal](#cómo-se-calcula-el-corte-semanal)
4. [Food cost y gastos sobre ventas](#food-cost-y-gastos-sobre-ventas)
5. [Gastos recurrentes y prorrateo](#gastos-recurrentes-y-prorrateo)
6. [Retiros del dueño](#retiros-del-dueño)
7. [Cerrar el día: cuadrar la caja](#cerrar-el-día-cuadrar-la-caja)
8. [Clientes por día y ticket promedio](#clientes-por-día-y-ticket-promedio)
9. [Merma: lo que se pierde](#merma-lo-que-se-pierde)
10. [Inventario: valor, días que alcanza y capital](#inventario-valor-días-que-alcanza-y-capital)
11. [Simulador de precios](#simulador-de-precios)
12. [Metas del mes](#metas-del-mes)
13. [Corte mensual](#corte-mensual)
14. [Ejemplo de éxito (para comprobar que todo funciona)](#ejemplo-de-éxito-para-comprobar-que-todo-funciona)
15. [Publicar la app en GitHub Pages](#publicar-la-app-en-github-pages)
16. [Activar la sincronización con Firebase](#activar-la-sincronización-con-firebase)
17. [Compartir con la familia y usar varios teléfonos](#compartir-con-la-familia-y-usar-varios-teléfonos)
18. [Instalar la app en el teléfono](#instalar-la-app-en-el-teléfono)
19. [Uso diario recomendado](#uso-diario-recomendado)
20. [Editar, borrar y deshacer](#editar-borrar-y-deshacer)
21. [Filtros y búsqueda](#filtros-y-búsqueda)
22. [Modo local y modo nube](#modo-local-y-modo-nube)
23. [Seguridad y respaldos](#seguridad-y-respaldos)
24. [Problemas frecuentes](#problemas-frecuentes)
25. [Actualizar la app](#actualizar-la-app)
26. [Para quien programa (apéndice)](#para-quien-programa-apéndice)

---

## Qué hace la app

La app tiene estas pantallas:

| Pantalla | Para qué sirve |
| --- | --- |
| **Inicio** | Resumen del día y de la semana, dinero que queda, alertas de salud del negocio y avance de tu meta. |
| **Ventas** | Registrar el total vendido del día, cuántos clientes hubo y **cerrar la caja** (cuadrar el efectivo). Descargable en CSV. |
| **Gastos** | Sueldos, renta, luz, agua, gas… Cada gasto se marca como **fijo o variable**, puede ser **recurrente** (semana, quincena, mes) y los retiros del dueño van aparte. Descargable en CSV. |
| **Compras** | Insumos que entran al inventario, con su costo. Se pueden **editar** y **deshacer** el borrado. Descargable en CSV. |
| **Inventario** | Conteo físico de lo que queda, **merma**, estimación del inventario actual con su **valor**, **días que alcanza** y **capital total**. Descargable en CSV. |
| **Insumos** | Catálogo: base de nieve, toppings y **tipos personalizados** (desechables, limpieza, etc.). |
| **Corte semanal** | Consumo, costo, **dinero que queda en caja**, ganancia real, food cost, compra sugerida, comparación con la semana anterior y **análisis de viabilidad**. |
| **Corte mensual** | Cómo va el mes: escalera de las ventas a la utilidad neta, comparación con el mes anterior, meta del mes. Imprimible y descargable en CSV. |
| **Ajustes** | Código de familia, sincronización, **meta del mes**, **respaldo y restauración**, instalación. |

Reglas importantes del negocio:

- **El inventario solo cambia con compras y conteos físicos.** Las ventas **nunca** descuentan gramos automáticamente.
- El consumo real se obtiene con los conteos físicos, no con lo que “debería” haberse vendido.
- La semana del negocio va de **sábado a viernes**.
- La zona horaria del negocio es **America/Mexico_City**, aunque el teléfono esté en otro país.
- Los costos se valorizan con el **costo promedio ponderado** de las compras.
- Los registros viejos siguen funcionando igual: todo lo nuevo es opcional. Si nunca capturas tickets, merma, cierres ni metas, los números salen igual que siempre.

---

## El dinero de la caja y la ganancia no son lo mismo

Nuvy te muestra **dos números distintos** porque responden preguntas distintas:

- **Dinero que te queda esta semana:** `ventas − gastos pagados − compras − retiros del dueño`. Es el efectivo que de verdad movió la caja. Si compras mucho insumo, aquí baja aunque el negocio vaya bien, porque ese insumo todavía lo tienes.
- **Ganancia contable de la semana:** `ventas − gastos − costo de lo vendido − costo de la merma`. Es lo que el negocio ganó de verdad. Las compras no se restan completas: solo se resta lo que se consumió. Los retiros del dueño no se restan aquí (es tu sueldo, no un gasto del negocio).

Ambos aparecen en **Inicio** y en **Corte semanal**. Si el dinero en caja no cuadra con la ganancia, la diferencia suele ser inventario que compraste y todavía tienes, o retiros que te llevaste.

---

## Cómo se calcula el corte semanal

Para cada insumo, dentro de la semana de sábado a viernes:

```text
Consumo = inventario inicial + compras de la semana − inventario final
Vendido = consumo − merma registrada
```

- **Inventario inicial:** el último conteo registrado **en o antes del sábado** de esa semana.
- **Inventario final:** el último conteo registrado **después del sábado y hasta el viernes**.
- **Compras de la semana:** todas las compras con fecha dentro de la semana.
- **Costo del consumo:** `consumo × costo promedio por gramo o mililitro`.
- **Costo promedio ponderado:** `total pagado en todas las compras hasta la fecha ÷ total de gramos o mililitros comprados`. Si todavía no hay compras, se usa el precio del catálogo.
- **Ganancia real (contable):** `ventas de la semana − gastos prorrateados de la semana − costo de lo vendido − costo de la merma`.
- **Compra sugerida:** `consumo de la semana × (1 + colchón) − inventario final`.
  - El **colchón** estándar es 10 % (se puede cambiar en `js/config.js`, `purchaseCushionPercent`): la app sugiere comprar un poco más de lo que consumiste para no quedarte corto.
  - Si lo que quedó en inventario ya cubre el consumo más el colchón, **no se sugiere nada**.
  - Bolsas y piezas se redondean **hacia arriba** (no se compran fracciones). Kilogramos y litros se redondean **hacia arriba a 2 decimales**.

El corte también compara la semana contra la **semana anterior**: cuánto subieron o bajaron las ventas, los gastos, el consumo y la ganancia, con el porcentaje de cambio. Si la semana anterior no tiene datos, dice “sin comparación”.

### Análisis de viabilidad (¿voy bien o mal?)

El corte también incluye un panel que responde si el precio actual deja ganancia:

- **Costo del producto por gramo:** lo que cuesta la mezcla vendida (base + toppings secos y líquidos; 1 L se toma como 1 kg). Los insumos de tipos personalizados (desechables, limpieza) no cuentan como producto: son de apoyo.
- **Precio real por gramo:** ventas ÷ gramos **vendidos** (sin contar merma).
- **Ganancia por gramo:** precio real − costo por gramo.
- **Punto de equilibrio semanal:** las ventas mínimas para no perder dinero. Se calcula como `(gastos fijos + gastos variables + costo de insumos de apoyo consumidos + costo de la merma) ÷ margen bruto`.

Solo necesita que registres los conteos físicos: sin conteos no hay consumo conocido y el panel te lo avisa.

El corte también avisa cuando:

- Falta el conteo final de un insumo.
- Hay una compra **dentro de la misma semana** después del último conteo (el conteo quedó viejo). Las compras de semanas siguientes ya no avisan: pertenecen a esa otra semana y no deben invalidar este corte.
- No hay conteo inicial y se asumió 0.
- El conteo inicial es **muy viejo** (más de 10 días antes del sábado). El aviso dice, por ejemplo: *"Tu conteo inicial es del 1 de agosto de 2026 (hace 98 días). El consumo de esta semana puede estar inflado; registra un conteo más reciente."* El cálculo no cambia: solo te avisa que ese conteo ya no refleja lo que tenías al inicio de la semana.
- El conteo final es mayor que el inventario inicial más las compras.
- La merma registrada de un insumo es mayor que su consumo: se te avisa y la merma se limita a lo consumido.

La app maneja **varios conteos y varias compras dentro de la misma semana**, incluso un conteo en cero a media semana seguido de una compra nueva. Para el corte toma el conteo más reciente antes del sábado y el más reciente del resto de la semana.

---

## Food cost y gastos sobre ventas

En **Corte semanal** hay dos porcentajes con color:

- **Food cost:** `costo del producto vendido ÷ ventas`. Cuánto de cada peso vendido se fue en materia prima.
  - **Verde** hasta 30 %: bien.
  - **Ámbar** hasta 38 %: revisa precios o mermas.
  - **Rojo** arriba de 38 %: estás vendiendo muy barato o desperdiciando mucho.
- **Gastos sobre ventas:** `gastos (prorrateados) ÷ ventas`, con la frase clara: *"De cada $100 que vendiste, $20 se fueron en gastos."*

Los umbrales del food cost (30 % y 38 %) se pueden ajustar en `js/config.js` (`foodCostGoodPercent` y `foodCostWarningPercent`). El food cost usa solo lo **vendido**: la merma se cobra aparte en la ganancia.

---

## Gastos recurrentes y prorrateo

Antes, cada gasto contaba una sola vez en su fecha. Ahora puedes decirle a la app **cada cuánto lo pagas**:

| Periodo | Qué significa |
| --- | --- |
| **Una sola vez** | Como siempre: cuenta completo el día que lo registraste. Es el default y el de todos los gastos viejos. |
| **Cada semana** | Se cobra cada semana. Si la semana lo cubre entera, cuenta completo. |
| **Cada quincena** | La renta o sueldos quincenales: se prorratea por día. |
| **Cada mes** | La renta o la luz mensual: se prorratea por día. |

**Prorrateo por día:** cuando un periodo no cae completo dentro de la semana, la app cobra la parte proporcional:

```text
Parte de la semana = monto × días traslapados ÷ días del periodo
```

Ejemplo: una renta mensual de $6,000 (30 días) que traslapa 7 días de la semana cobra `6,000 × 7 ÷ 30 = $1,400` en el corte de esa semana. Así una renta mensual ya no te “desaparece” la ganancia de una sola semana: se reparte entre las cuatro.

En la pantalla **Gastos**, los recurrentes traen la etiqueta **“Recurrente”** y cuánto les toca de la semana actual. El selector se llama **“¿Cada cuánto lo pagas?”**.

En el **corte mensual** no hay prorrateo visible: los periodos mensuales caen completos en su mes.

---

## Retiros del dueño

El dinero que te sacas del negocio **no es un gasto**. Si lo registras como gasto, te distorsiona la ganancia y el punto de equilibrio.

En **Gastos** hay una tercera categoría: **“Retiro del dueño”**. Los retiros:

- **No** se restan de la ganancia contable ni del food cost.
- **Sí** se restan del **dinero que queda en la caja**.
- **Sí** se restan de la **utilidad neta del corte mensual** (la utilidad de operación menos tus retiros).

Así puedes ver por separado qué tanto dejó el negocio y cuánto de eso te llevaste.

---

## Cerrar el día: cuadrar la caja

En **Ventas** está el bloque **“Cerrar el día”**:

1. Al terminar el día, cuenta el efectivo que quedó en la caja.
2. Escríbelo en **Efectivo contado en la caja**.
3. Si aceptas tarjeta, escribe las **ventas con tarjeta** del día: la app las resta del efectivo esperado.
4. Guarda el cierre. La app te dice si **cuadra**, **falta** o **sobra**, y por cuánto.

Cada cierre guarda la fecha, el efectivo esperado, el contado, la tarjeta y una nota libre. La app muestra los últimos 20 cierres y un **resumen de la semana**: cuánto falta y cuánto sobra en total entre todos los cierres de la semana. Si siempre te falta lo mismo, algo se está colando de la caja.

> El cierre no borra ni cambia ventas: es una foto de la caja para detectar faltantes.

---

## Clientes por día y ticket promedio

Al registrar una venta puedes capturar (es opcional) **cuántos clientes o tickets hubo ese día**. Con eso el corte calcula:

- **Ticket promedio:** `total vendido ÷ clientes`. Solo usa las ventas que traen clientes.
- **Gramos por cliente:** cuántos gramos de mezcla se lleva cada cliente en promedio.

Si no capturas clientes, no aparece nada de esto y los demás números salen igual. Sirve para decidir precios: si el ticket promedio es bajo, conviene subir el precio por gramo en lugar de vender más.

---

## Merma: lo que se pierde

Se derritió nieve, se cayó un bote, regalaste una muestra… eso es **merma**: inventario que se consumió sin venderse.

En **Inventario** está el bloque **“Registrar merma”**:

1. Elige el insumo y la cantidad (en la unidad que quieras: g, kg, bolsas…).
2. Elige el motivo: **se derritió**, **se cayó**, **muestra** o **otro**.
3. Guarda. La cantidad se convierte a la unidad base del insumo.

Cómo afecta los números:

- **Consumo:** la merma **sí** forma parte del consumo (inicial + compras − final).
- **Vendido:** la merma se resta: `vendido = consumo − merma`. El food cost y el precio por gramo usan solo lo vendido.
- **Ganancia:** la merma se cobra **aparte** como costo: si regalaste $50 de nuez, la ganancia baja $50.
- **Punto de equilibrio:** la merma entra en lo que hay que cubrir antes de ganar.
- Si registras más merma que el consumo de la semana, la app te avisa y solo descuenta lo posible.

La merma se puede borrar como cualquier registro (con su **Deshacer**).

---

## Inventario: valor, días que alcanza y capital

En **Inventario**, la tabla de inventario estimado ahora muestra tres columnas nuevas:

- **Valor:** lo que vale lo que queda de cada insumo al costo promedio (`cantidad restante × costo por gramo`).
- **Días que alcanza:** con tu consumo diario promedio de las **últimas 4 semanas**, cuántos días aguanta lo que queda. Si hay poco historial, sale “—”.
- **Capital total:** la suma del valor de todos los insumos: cuánto dinero tienes “parado” en inventario.

Además, al hacer un conteo, el formulario **se precarga con el inventario estimado** y te lo marca claro: *“Precargado con el inventario estimado — ajústalo al conteo real antes de guardar.”* Nunca se guarda solo: tú confirmas con el botón.

---

## Simulador de precios

En **Corte semanal** está el bloque **“¿Cuánto cobrar?”**. Mueve un deslizador para probar distintos precios por gramo y la app te muestra al instante:

- Los ingresos que tendrías con ese precio.
- El costo del producto que vendiste.
- La **ganancia por semana** con ese precio.

Sirve para responder “si subo 10 centavos el gramo, ¿cuánto más gano al mes?” sin hacer cuentas a mano. El costo usa el promedio ponderado de tus compras reales.

---

## Metas del mes

En **Ajustes** puedes fijar una **meta del mes**:

- **¿Cuánto quieres vender?** (por ejemplo, $40,000).
- **Tope de gastos** (por ejemplo, $8,000). Sin contar compras de insumos ni tus retiros.

Puedes dejar solo una de las dos. Con la meta guardada:

- **Inicio** muestra barras de avance: cuánto llevas vendido, cuánto falta, y cuánto te queda del tope de gastos.
- El **corte mensual** muestra lo mismo dentro de su pantalla.

La meta se guarda por mes (`2026-11`), así que cada mes puedes ponerte una nueva. Quitarla no toca ningún dato de ventas ni gastos.

---

## Corte mensual

En el menú lateral está **Corte mensual**. Ahí ves el mes entero, con selector de mes y botones de mes anterior/siguiente.

La pantalla principal es la **escalera de las ventas a la utilidad neta**:

```text
Ventas del mes
− Costo del producto vendido
− Costo de la merma
= Utilidad bruta
− Gastos fijos (con la parte de los recurrentes)
− Gastos variables
− Insumos de apoyo consumidos (vasos, servilletas…)
= Utilidad de operación
− Retiros del dueño
= Utilidad neta
```

Cada renglón explica de dónde sale el siguiente. Además:

- **Comparación contra el mes anterior:** ventas, gastos, consumo, utilidad… con porcentajes de cambio.
- **Detalle por insumo:** inventario inicial + compras del mes − inventario final, con merma separada.
- **Meta del mes** con barras de avance.
- **Imprimir** (sale limpio, sin botones) y **Descargar CSV** con la escalera completa.
- Los gastos **mensuales** caen completos en su mes (no se prorratean como en el corte semanal).
- Las **compras** se muestran aparte como “dinero que se fue a inventario”, no se restan de la utilidad.

> El corte mensual necesita los mismos conteos que el semanal: el conteo más cercano al inicio del mes y al final del mes.

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
- Ganancia real (contable): **$3,800** (`$5,000 − $1,000 − $200 vendido − $0 de merma`)
- **Dinero que queda en la caja:** **$3,500** (`$5,000 − $1,000 gastos − $500 compras`). La diferencia con la ganancia son los $500 de insumo que compraste y todavía tienes.
- Food cost: **4 %** (verde). De cada $100 vendidos, $4 se fueron en producto.
- Gastos sobre ventas: **20 %**. De cada $100 vendidos, $20 se fueron en gastos.
- Compra sugerida: **ninguna**. La base consumió 2,000 g y quedan 6,000 g; con el colchón del 10 % el objetivo es 2,200 g y ya lo tienes cubierto. Igual la nuez (objetivo 440 g, quedan 1,600 g).
- Como no se capturaron clientes ni merma, no aparecen ticket promedio ni costo de merma.

> **Nota:** para ver este ejemplo en el corte, selecciona una fecha dentro de esa semana (por ejemplo, 09/11/2026) en la pantalla **Corte semanal**. La app usa la semana completa, no solo el día elegido.

> **¿Y si hubiera quedado poco inventario?** Si el conteo final de la base fuera 1,000 g en lugar de 6,000 g, el consumo sería 7,000 g, el objetivo con colchón 7,700 g, lo que falta 6,700 g → **2 bolsas** sugeridas (se redondea hacia arriba).

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

1. **Ventas:** al terminar el día, registra el total vendido y (si quieres) cuántos clientes hubo.
2. **Cerrar la caja:** en **Ventas** → **Cerrar el día**, cuenta el efectivo y guárdalo. La app te dice si falta o sobra.
3. **Gastos:** registra sueldos, luz, renta y cualquier gasto que no sea compra de insumos.
   - Marca cada gasto como **fijo** (renta, luz, agua, sueldos, internet) o **variable** (gasolina, imprevistos).
   - Si es algo que pagas cada semana, quincena o mes, márcalo como **recurrente** para que se prorratee solo.
   - El dinero que te llevas del negocio regístralo como **retiro del dueño**, no como gasto.
   - Cuando escribes un concepto claramente fijo, la app lo sugiere sola.

### Cada vez que compres insumos

1. Ve a **Compras**.
2. Elige el insumo, la cantidad comprada y el total pagado.
3. La app convierte automáticamente a gramos, mililitros o piezas y actualiza el costo promedio.
   - Los toppings líquidos se pueden comprar **por litro o por kilogramo**. Para el cálculo, la app toma 1 litro o 1 kg como 1,000 ml.
4. Si te equivocaste, toca el botón de **editar** en la compra, corrige la fecha, el insumo, la cantidad o el total, y guarda. El inventario y el costo se recalculan solos.

### Cuando algo se pierda

- Se derritió, se cayó o regalaste una muestra: regístralo en **Inventario** → **Registrar merma**. Así el corte separa lo que vendiste de lo que perdiste.

### Los viernes (o cuando cierres la semana)

1. Ve a **Inventario**.
2. Cuenta físicamente cada insumo. El formulario llega **precargado con el inventario estimado**: ajústalo al número real y guarda.
3. Si un insumo se acabó a media semana:
   - Registra un conteo en **0**.
   - Registra la compra nueva.
   - Al viernes, registra el conteo final.
4. Ve a **Corte semanal** y revisa:
   - **Dinero que queda** y **ganancia contable**.
   - Food cost y gastos sobre ventas.
   - Consumo por insumo y costo.
   - Comparación contra la semana anterior.
   - **Compra sugerida** para la próxima semana (ya descuenta lo que te quedó).
5. Si quieres ver cómo va el mes completo, ve a **Corte mensual**.

### El sábado

- Empieza la nueva semana.
- El conteo del viernes se convierte en el inventario inicial de la semana que empieza, siempre que lo hayas registrado con la fecha correcta.

### Cada mes

- Pon o ajusta tu **meta del mes** en **Ajustes**.
- Al cerrar el mes, revisa el **corte mensual** y descárgalo o imprímelo.

### Exportar datos (CSV)

En **Ventas**, **Gastos**, **Compras** e **Inventario** hay un botón **Descargar CSV**. El archivo abre directo en Excel o Google Sheets con acentos correctos y números listos para sumar. El nombre del archivo incluye la fecha, por ejemplo `nuvy-gastos-2026-11-09.csv`. El corte mensual también se descarga en CSV.

### Tipos de insumo personalizados

En **Insumos** puedes crear tus propias categorías además de base, seco y líquido. Por ejemplo: **Desechables**, **Material de limpieza** o **Empaques**.

1. En **Insumos**, toca **Agregar tipo**.
2. Escribe el nombre y elige cómo se mide:
   - **Piezas:** para vasos, servilletas, cucharas, bolsas, etc.
   - **Gramos:** para productos que se pesan.
   - **Mililitros:** para líquidos.
3. La app arma sola las unidades de compra y de conteo. Por ejemplo, un tipo por piezas se compra por **pieza o bolsa** y se cuenta en **piezas o bolsas**.
4. Puedes **renombrar** un tipo cuando quieras. Si ya tiene insumos registrados, no se puede cambiar cómo se mide (para no mezclar piezas con gramos).
5. Solo puedes **borrar** un tipo que no tenga insumos. Si lo necesitas, primero cambia esos insumos a otro tipo.

---

## Editar, borrar y deshacer

- **Editar:** las **ventas** y los **gastos** se pueden editar después de guardarlos (igual que las compras): toca el botón de editar, corrige lo que sea y guarda. El corte se recalcula solo.
- **Borrar:** al borrar una venta, gasto, compra, merma o cierre, aparece abajo un aviso con el botón **Deshacer** durante unos segundos.
- **Deshacer:** toca el botón antes de que desaparezca y el registro vuelve **exactamente como estaba**, con su misma fecha e identidad. Sirve también entre teléfonos: al deshacer, la app restaura el mismo registro en lugar de crear uno nuevo.

> Los borrados más delicados (como compras) siguen pidiendo confirmación antes de borrarse.

---

## Filtros y búsqueda

En **Ventas**, **Gastos**, **Compras** e **Inventario** hay una barra de filtros arriba de la lista:

- **Desde / Hasta:** rango de fechas. Con atajos de un toque: **Este mes**, **Mes pasado**, **Últimos 30 días**, **Todo**.
- **Buscar:** en Gastos busca por concepto; en Compras por insumo.
- **Filtro por insumo:** en Compras e Inventario puedes ver un solo insumo.
- La lista muestra primero 50 registros y un botón **Ver más** para cargar el resto de 50 en 50.

Los filtros se recuerdan mientras navegas entre pantallas y se limpian al salir de la vista.

---

## Modo local y modo nube

### Modo local

- Se usa cuando Firebase todavía no está configurado o cuando la nube no está disponible.
- Los datos se guardan **solamente en ese teléfono** (en el almacenamiento del navegador).
- La app funciona completa: insumos, compras, ventas, gastos, conteos, merma, cierres y cortes.
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

### Respaldo en un archivo (recomendado)

En **Ajustes** → **Respaldo** puedes descargar **todos tus datos en un archivo JSON** y restaurarlos en cualquier teléfono:

1. **Descargar respaldo:** genera un archivo `nuvy-respaldo-YYYY-MM-DD.json` con todos los registros de la familia, listo para guardar en tu correo, WhatsApp o nube de archivos.
2. **Restaurar respaldo:** elige el archivo (o pega su texto) y la app te muestra una **vista previa** de qué contiene: cuántos insumos, compras, ventas, gastos, conteos, mermas, cierres y metas, y a qué familia pertenece.
3. Al confirmar, la restauración **no borra nada**: si un registro ya existe, se actualiza; si no existe, se agrega. Es una fusión, no un reemplazo.
4. Si el respaldo es de **otra familia**, la app te lo avisa y pide una confirmación extra antes de mezclar los datos.

Además:

- Si pasan **más de 30 días** sin respaldo, la app te lo recuerda en **Inicio**.
- El respaldo sirve también para **cambiar de teléfono** o para recuperar los datos si borras los datos del navegador en modo local.
- Con la nube activa, lo ideal es tener las dos cosas: Firestore (sincronización en vivo) y el archivo JSON (tu copia de seguridad).

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
- Si tienes el archivo de respaldo, también puedes restaurarlo en el otro teléfono para arrancar.

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

### La merma es mayor que el consumo

- La app te avisa y solo descuenta la merma posible.
- Revisa la cantidad y la unidad de la merma (quizá capturaste kg en lugar de g).
- Revisa que el conteo final esté bien: la merma no puede ser mayor que lo consumido.

### La compra sugerida salió vacía

- No es un error: la app sugiere comprar solo si `consumo + 10 %` supera lo que te quedó de inventario.
- Si el viernes todavía queda bastante insumo, no se sugiere nada. Revisa la columna **Días que alcanza** en Inventario.

### El “dinero que queda” no cuadra con la ganancia

- Son números distintos a propósito: el dinero de la caja resta las compras completas y los retiros; la ganancia solo resta lo consumido y la merma.
- La diferencia es inventario que compraste y todavía tienes, o retiros que te llevaste.

### Los números no coinciden con lo que esperaba

- Revisa la **fecha** de cada movimiento: la semana es sábado a viernes.
- Revisa la **unidad** del conteo (g, kg, bolsas, piezas, ml, L).
- Revisa el **contenido por unidad** del insumo (por ejemplo, cuántos gramos trae una bolsa).
- Revisa si hay compras con fecha posterior al conteo final.
- Revisa si registraste merma esa semana: la merma se resta de lo vendido y se cobra aparte.

### Cambié un archivo y no veo el cambio

- GitHub Pages tarda de 1 a 3 minutos en publicar.
- El service worker guarda una copia para funcionar sin internet. Cierra y vuelve a abrir la app, o recarga dos veces.
- Si el cambio es importante, sube el número `VERSION` en `sw.js` (por ejemplo, de `nuvy-admin-v1.1.0` a `nuvy-admin-v1.1.1`) antes de publicar.

### Quiero empezar de cero en un teléfono

- En **Ajustes** puedes cambiar de código de familia.
- Para borrar los datos locales de un código, borra los datos del sitio desde la configuración del navegador. **Esto no borra los datos de Firebase**, solo la copia de ese teléfono.
- Para borrar los datos de la nube, hazlo desde Firebase Console → Firestore Database.
- Antes de borrar, descarga tu **respaldo JSON** por si quieres recuperar algo después.

---

## Actualizar la app

1. Descarga o prepara los archivos nuevos.
2. Si cambiaste archivos importantes, sube el número `VERSION` en `sw.js`.
3. En GitHub, entra al repositorio y sube los archivos reemplazando los anteriores (**Add file** → **Upload files**, o edita el archivo directamente).
4. Espera de 1 a 3 minutos.
5. Abre la app y recárgala. Si no ves el cambio, ciérrala y ábrela de nuevo.

Los datos **no se pierden** al actualizar: están en Firebase (modo nube) o en el almacenamiento del teléfono (modo local). Los registros viejos siguen válidos: las funciones nuevas son opcionales y no cambian los números de lo que ya tenías capturado.

La versión actual es la **1.1.0**.

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
  config.js                Configuración de Firebase, zona horaria y umbrales
  core/
    dates.js               Fechas y semana sábado-viernes
    format.js              Formatos de moneda y números
    units.js               Unidades y conversiones (g, kg, ml, L, bolsa, pieza)
    validation.js          Validación de formularios, periodos y categorías
    inventory.js           Conteos, compras, consumo diario y costo ponderado
    weekly-cut.js          Corte semanal (prorrateo, merma, food cost, sugerencias)
    monthly-cut.js         Corte mensual (escalera de utilidades)
    backup.js              Respaldo y restauración JSON
  services/
    settings-store.js      Código de familia, configuración y enlaces
    local-adapter.js       Almacenamiento local y sincronización entre pestañas
    firestore-adapter.js   Firestore con caché offline y tiempo real
    store.js               API central de datos (getWeeklyCut, getMonthlyCut…)
  ui/                      Componentes e íconos
  views/                   Pantallas (incluye filters.js y mensual.js)
tests/                     Pruebas con node --test (78 pruebas)
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
- `supplyType` — tipo de insumo personalizado (desechables, limpieza, etc.)
- `purchase` — compra de insumo
- `sale` — venta del día (con `tickets` opcional)
- `expense` — gasto (con `category` fixed/variable/owner y `period` once/weekly/fortnightly/monthly)
- `count` — conteo físico
- `waste` — merma con motivo (se derritió, se cayó, muestra, otro)
- `cashClose` — cierre de caja (efectivo contado, tarjeta y nota)
- `goal` — meta del mes (ventas y tope de gastos)

Campos comunes: `id`, `kind`, `createdAt`, `updatedAt`, `schemaVersion`.

Reglas de compatibilidad para agregar un `kind` nuevo: registrarlo en `js/services/store.js` (getters y alta), validarlo en `js/core/validation.js`, permitirlo en `firestore.rules` **y** en `tests/firestore-rules.test.js`, incluirlo en `js/core/backup.js` (`KNOWN_KINDS`) y, si trae archivos JS nuevos, en el `APP_SHELL` de `sw.js`.

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
npm test          # 78 pruebas: cortes, mensual, registros, reglas y tipos
npm run check     # revisión de sintaxis
npm run serve     # servidor local en http://localhost:8080
```

> El service worker y la instalación PWA requieren HTTPS o `localhost`. Abrir `index.html` como archivo (`file://`) no activa el modo offline.

### Publicación

Cualquier hosting estático sirve (GitHub Pages, Netlify, Cloudflare Pages). No hay paso de compilación: se suben los archivos tal cual. GitHub Actions corre `npm test` y `npm run check` en cada push (`.github/workflows/pages.yml`).

---

Hecho para que el negocio sepa **cuánto ganó de verdad**, no solo cuánto vendió.
