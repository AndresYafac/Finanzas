# ConfiguraciÃ³n de FinTrack Pro con Supabase

## 1. Crear el proyecto

1. Entra a [Supabase](https://supabase.com/dashboard) y crea una cuenta.
2. Pulsa **New project**.
3. Elige una organizaciÃ³n, nombre del proyecto, contraseÃ±a de base de datos y regiÃ³n.
4. Espera a que el proyecto termine de aprovisionarse.

## 2. Instalar la base de datos

1. En Supabase abre **SQL Editor**.
2. Crea una consulta nueva.
3. Copia todo el contenido de `../supabase/sql/supabase-schema.sql`.
4. Ejecuta la consulta con **Run**.

El esquema crea las tablas, polÃ­ticas RLS, Ã­ndices, perfil automÃ¡tico y funciones
transaccionales para registrar y eliminar pagos.

Si ya habÃ­as ejecutado una versiÃ³n anterior del esquema, vuelve a ejecutar el
archivo completo. Las instrucciones usan `create or replace` y `if not exists`,
por lo que tambiÃ©n funciona como actualizaciÃ³n.

## 3. Obtener las credenciales pÃºblicas

1. Abre **Project Settings > API Keys**.
2. Copia la **Project URL**.
3. Copia una clave **Publishable**. Si el proyecto todavÃ­a usa claves antiguas,
   copia la clave **anon public**.
4. No copies ni publiques una clave **service_role** o **secret**.

La clave pÃºblica puede estar en el navegador porque las polÃ­ticas RLS protegen
cada registro. Las claves secretas omiten esas protecciones y no deben incluirse
en HTML.

## 4. Ejecutar el sistema

Abre PowerShell en esta carpeta y ejecuta:

```powershell
python -m http.server 8080
```

DespuÃ©s abre:

```text
http://localhost:8080/fintrack.html
```

En la pantalla inicial:

1. Pulsa **Configurar conexiÃ³n con Supabase**.
2. Pega la URL y la clave pÃºblica.
3. Pulsa **Probar y guardar conexiÃ³n**.

La configuraciÃ³n queda guardada en el almacenamiento local de ese navegador.

## 5. Crear la primera cuenta Admin

1. En FinTrack abre la pestaÃ±a **Registrarse**.
2. Escribe nombre, apellido, correo y una contraseÃ±a de al menos 8 caracteres.
3. Pulsa **Crear cuenta**.
4. Si la confirmaciÃ³n de correo estÃ¡ habilitada, abre el correo de Supabase y
   confirma la cuenta.
5. Inicia sesiÃ³n.

El primer usuario registrado recibe automÃ¡ticamente el rol `admin`. Los
registros posteriores reciben el rol `user`. Cada cuenta administra Ãºnicamente
sus propios clientes, cuentas, deudas y pagos.

Los usuarios con rol `user` se vinculan automÃ¡ticamente a un registro de
`clientes` perteneciente al Admin. En su sesiÃ³n solo pueden consultar sus
propias deudas, pagos y perfil; no pueden administrar clientes ni Supabase.

DespuÃ©s de detectar el primer Admin, FinTrack oculta la ediciÃ³n pÃºblica de la
conexiÃ³n, pero mantiene disponible **Registrarse** para usuarios normales. Las
credenciales solo pueden editarse desde **ConfiguraciÃ³n** dentro del panel Admin.

TambiÃ©n puedes crear la cuenta desde **Supabase > Authentication > Users >
Add user**. El perfil se crearÃ¡ automÃ¡ticamente y podrÃ¡s completar el nombre
desde **Mi perfil**.

## 6. Cerrar el registro pÃºblico

DespuÃ©s de crear tu Admin, si solo tÃº usarÃ¡s el sistema:

1. Abre la configuraciÃ³n de **Authentication** en Supabase.
2. Desactiva la opciÃ³n que permite nuevos registros de usuarios.

El inicio de sesiÃ³n seguirÃ¡ funcionando, pero nadie podrÃ¡ crear otra cuenta
desde la pantalla pÃºblica.

## 7. Configurar las URL de autenticaciÃ³n

En **Authentication > URL Configuration** configura:

```text
Site URL: http://localhost:8080
Redirect URL: http://localhost:8080/fintrack.html
```

Cuando publiques el sistema, reemplaza esas URL por el dominio HTTPS definitivo.

## Notas de seguridad

- No subas claves `service_role`, `secret` ni la contraseÃ±a de la base de datos.
- Usa HTTPS al publicar el sistema.
- Para producciÃ³n, mueve la URL y la clave pÃºblica a un archivo de configuraciÃ³n
  del despliegue en vez de pedirlas a cada navegador.
- Revisa periÃ³dicamente **Database > Advisors** y **Authentication > Logs**.

DocumentaciÃ³n oficial:

- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [GestiÃ³n de usuarios](https://supabase.com/docs/guides/auth/managing-user-data)

