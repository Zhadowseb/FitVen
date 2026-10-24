// Inicio de sesión, registro, consentimiento y errores de autenticación.
export default {
  createAccount: "Crear cuenta",
  fields: {
    email: "Correo electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    password: "Contraseña",
    passwordPlaceholder: "Introduce tu contraseña",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
  },
  errors: {
    enterEmail: "Introduce tu correo electrónico.",
    enterPassword: "Introduce tu contraseña.",
    enterEmailFirst: "Introduce primero tu correo electrónico.",
    signInToDeleteAccount: "Tienes que iniciar sesión para eliminar tu cuenta.",
    couldNotDeleteAccount: "No se pudo eliminar la cuenta.",
  },
  login: {
    title: "Iniciar sesión",
    subtitle: "Inicia sesión para cargar tus programas y entrenamientos.",
    submit: "Iniciar sesión",
    signingIn: "Iniciando sesión...",
    couldNotSignIn: "No se pudo iniciar sesión.",
    forgotPassword: "¿Olvidaste tu contraseña?",
    sending: "Enviando...",
    enterEmailThenTapAgain: "Introduce tu correo electrónico y toca de nuevo aquí.",
    resetLinkSent:
      "Si esa dirección tiene una cuenta, te llegará un enlace para crear una contraseña nueva. Caduca y solo funciona una vez.",
    couldNotSendEmail: "No se pudo enviar el correo. Inténtalo de nuevo.",
    newHere: "¿Eres nuevo?",
  },
  register: {
    subtitle: "Una cuenta sincroniza tus programas y entrenamientos entre dispositivos.",
    username: "Nombre de usuario",
    usernamePlaceholder: "tu_nombre",
    usernamePreviewExample: "tu_nombre#1234",
    usernameHint:
      "FitVen añade una etiqueta de 4 dígitos, así que aparecerá como {preview}. La etiqueta no se puede cambiar después.",
    passwordMinLength: {
      one: "Al menos {count} carácter.",
      other: "Al menos {count} caracteres.",
    },
    repeatPassword: "Repite la contraseña",
    termsCheckbox: "Acepto los términos de uso.",
    termsCheckboxAccessibility: "Acepto los términos de uso",
    termsSummary:
      "No se tolera el contenido inapropiado ni el comportamiento abusivo. Si lo incumples, se elimina la cuenta.",
    readFullTerms: "Leer los términos de uso completos",
    howDataIsHandled: "Cómo trata FitVen tus datos",
    creating: "Creando cuenta...",
    errors: {
      pickUsername: "Elige un nombre de usuario.",
      usernameRules: "Usa de 3 a 20 letras minúsculas, números o guiones bajos.",
      choosePassword: "Elige una contraseña.",
      repeatPassword: "Escribe la contraseña otra vez.",
      passwordsDiffer: "Las dos contraseñas no coinciden.",
      acceptTerms: "Tienes que aceptar los términos para crear una cuenta.",
      couldNotCreate: "No se pudo crear la cuenta.",
    },
    done: {
      confirmEmailTitle: "Confirma tu correo",
      confirmEmailBody:
        "Hemos enviado un enlace a {email}. Ábrelo para confirmar la dirección y luego inicia sesión.",
      accountCreatedTitle: "Cuenta creada",
      accountCreatedBody: "Tu cuenta está lista. Inicia sesión para empezar.",
      goToLogin: "Ir a iniciar sesión",
    },
  },
  consent: {
    title: "Antes de continuar",
    body:
      "Hay dos cosas que aceptar. Los términos de uso establecen lo que se permite y lo que no en FitVen: no se tolera el contenido inapropiado ni el comportamiento abusivo. La política de privacidad trata de tus datos: FitVen guarda tus entrenamientos y, a través de los registros de enfermedad, la frecuencia cardíaca y las carreras registradas con una versión anterior de FitVen, datos de salud sobre ti, para los que la ley europea exige tu permiso explícito. Léelos y toca Aceptar para continuar, o cierra la app si prefieres no hacerlo.",
    termsHeading: "Términos de uso",
    privacyHeading: "Política de privacidad",
    accept: "Aceptar ambos y continuar",
    saving: "Guardando...",
    couldNotSave: "No se pudo guardar tu respuesta. Inténtalo de nuevo.",
  },
};
