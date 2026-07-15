# App movil nativa con Capacitor

## Objetivo

Separar la experiencia movil de FinTrack para empaquetarla como aplicacion Android/iOS usando la base actual de React + Vite, sin reescribir todo el sistema.

## Recomendacion tecnica

Usar Capacitor porque permite reutilizar la app web actual y agregar capacidades nativas:

- Notificaciones push nativas.
- Biometria real del dispositivo.
- Secure Storage para tokens, PIN y preferencias.
- Publicacion como APK/AAB en Android.

## Fases propuestas

1. Preparar Capacitor en el proyecto.
2. Crear plataforma Android.
3. Ajustar variables de entorno para mobile.
4. Integrar Secure Storage.
5. Implementar biometria nativa.
6. Migrar notificaciones push a FCM.
7. Crear flujo de build y publicacion.

## Pendiente

No ejecutar ahora. Este documento queda como guia para retomarlo cuando se decida iniciar la app movil nativa.
