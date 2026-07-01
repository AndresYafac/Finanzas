# Configuración de FinTrack Pro con Supabase

## 1. Crear el proyecto

1. Entra a [Supabase](https://supabase.com/dashboard) y crea una cuenta.
2. Pulsa **New project**.
3. Elige una organización, nombre del proyecto, contraseña de base de datos y región.
4. Espera a que el proyecto termine de aprovisionarse.

## 2. Instalar la base de datos

1. En Supabase abre **SQL Editor**.
2. Crea una consulta nueva.
3. Copia todo el contenido de `supabase-schema.sql`.
4. Ejecuta la consulta con **Run**.

El esquema crea las tablas, políticas RLS, índices, perfil automático y funciones
transaccionales para registrar y eliminar pagos.

Si ya habías ejecutado una versión anterior del esquema, vuelve a ejecutar el
archivo completo. Las instrucciones usan `create or replace` y `if not exists`,
por lo que también funciona como actualización.

## 3. Obtener las credenciales públicas

1. Abre **Project Settings > API Keys**.
2. Copia la **Project URL**.
3. Copia una clave **Publishable**. Si el proyecto todavía usa claves antiguas,
   copia la clave **anon public**.
4. No copies ni publiques una clave **service_role** o **secret**.

La clave pública puede estar en el navegador porque las políticas RLS protegen
cada registro. Las claves secretas omiten esas protecciones y no deben incluirse
en HTML.

## 4. Ejecutar el sistema

Abre PowerShell en esta carpeta y ejecuta:

```powershell
python -m http.server 8080
```

Después abre:

```text
http://localhost:8080/fintrack.html
```

En la pantalla inicial:

1. Pulsa **Configurar conexión con Supabase**.
2. Pega la URL y la clave pública.
3. Pulsa **Probar y guardar conexión**.

La configuración queda guardada en el almacenamiento local de ese navegador.

## 5. Crear la primera cuenta Admin

1. En FinTrack abre la pestaña **Registrarse**.
2. Escribe nombre, apellido, correo y una contraseña de al menos 8 caracteres.
3. Pulsa **Crear cuenta**.
4. Si la confirmación de correo está habilitada, abre el correo de Supabase y
   confirma la cuenta.
5. Inicia sesión.

El primer usuario registrado recibe automáticamente el rol `admin`. Los
registros posteriores reciben el rol `user`. Cada cuenta administra únicamente
sus propios clientes, cuentas, deudas y pagos.

Los usuarios con rol `user` se vinculan automáticamente a un registro de
`clientes` perteneciente al Admin. En su sesión solo pueden consultar sus
propias deudas, pagos y perfil; no pueden administrar clientes ni Supabase.

Después de detectar el primer Admin, FinTrack oculta la edición pública de la
conexión, pero mantiene disponible **Registrarse** para usuarios normales. Las
credenciales solo pueden editarse desde **Configuración** dentro del panel Admin.

También puedes crear la cuenta desde **Supabase > Authentication > Users >
Add user**. El perfil se creará automáticamente y podrás completar el nombre
desde **Mi perfil**.

## 6. Cerrar el registro público

Después de crear tu Admin, si solo tú usarás el sistema:

1. Abre la configuración de **Authentication** en Supabase.
2. Desactiva la opción que permite nuevos registros de usuarios.

El inicio de sesión seguirá funcionando, pero nadie podrá crear otra cuenta
desde la pantalla pública.

## 7. Configurar las URL de autenticación

En **Authentication > URL Configuration** configura:

```text
Site URL: http://localhost:8080
Redirect URL: http://localhost:8080/fintrack.html
```

Cuando publiques el sistema, reemplaza esas URL por el dominio HTTPS definitivo.

## Notas de seguridad

- No subas claves `service_role`, `secret` ni la contraseña de la base de datos.
- Usa HTTPS al publicar el sistema.
- Para producción, mueve la URL y la clave pública a un archivo de configuración
  del despliegue en vez de pedirlas a cada navegador.
- Revisa periódicamente **Database > Advisors** y **Authentication > Logs**.

Documentación oficial:

- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Gestión de usuarios](https://supabase.com/docs/guides/auth/managing-user-data)
