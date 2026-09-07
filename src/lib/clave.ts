/**
 * Contraseñas que se dictan por teléfono y se recuerdan.
 *
 * Dos palabras cortas en español, sin tildes ni letras que se confundan al
 * oído, más dos dígitos: "SolVerde47". Diez u once caracteres, con mayúscula,
 * minúscula y número. No es una clave para proteger secretos de estado: es
 * para que un asesor entre a la aplicación y la cambie si quiere. Contra un
 * ataque por internet la frena el límite de intentos de Auth.
 */
const PALABRAS = [
  "sol", "luna", "mar", "rio", "cielo", "nube", "lluvia", "viento", "fuego", "tierra",
  "monte", "valle", "campo", "flor", "rosa", "pino", "roble", "cedro", "palma", "cafe",
  "cacao", "maiz", "trigo", "arroz", "miel", "leche", "pan", "sal", "uva", "pera",
  "mango", "coco", "limon", "fresa", "melon", "piña", "papaya", "lulo", "mora", "kiwi",
  "gato", "perro", "leon", "tigre", "oso", "lobo", "zorro", "pato", "gallo", "cisne",
  "loro", "buho", "aguila", "delfin", "tortuga", "conejo", "caballo", "vaca", "toro", "cabra",
  "rojo", "azul", "verde", "gris", "negro", "blanco", "dorado", "plata", "bronce", "cobre",
  "norte", "sur", "este", "oeste", "alto", "bajo", "largo", "corto", "nuevo", "viejo",
  "casa", "puerta", "mesa", "silla", "cama", "libro", "lapiz", "papel", "reloj", "llave",
  "carro", "moto", "barco", "avion", "tren", "bici", "calle", "plaza", "puente", "torre",
  "lunes", "martes", "jueves", "viernes", "enero", "marzo", "mayo", "junio", "julio", "agosto",
  "buga", "tulua", "cali", "cauca", "valle", "andes", "pacifico", "llano", "selva", "costa",
]

function al_azar(tope: number) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % tope
}

function capitalizar(p: string) {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

export function generarClave() {
  const a = PALABRAS[al_azar(PALABRAS.length)]
  let b = PALABRAS[al_azar(PALABRAS.length)]
  while (b === a) b = PALABRAS[al_azar(PALABRAS.length)]
  const numero = String(10 + al_azar(90))
  return `${capitalizar(a)}${capitalizar(b)}${numero}`
}
