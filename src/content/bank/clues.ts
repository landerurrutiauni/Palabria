import type { RawClues } from "./types";

/** «La pista justa»: cuatro pistas de la más vaga a la más concreta. Contenido original. */
export const CLUES_BANK: readonly RawClues[] = [
  [
    [
      "Suele estar en un lugar alto, cerca del agua.",
      "Su trabajo empieza al anochecer.",
      "Gira sin moverse del sitio.",
      "Su luz orienta a los barcos.",
    ],
    "faro",
    1,
  ],
  [
    [
      "Lo usas, lo cierras y a veces lo olvidas en algún sitio.",
      "Tiene varillas y un mango.",
      "Se abre cuando cambia el tiempo.",
      "Te protege de la lluvia.",
    ],
    "paraguas",
    1,
  ],
  [
    [
      "Está en casi todos los cuartos de baño.",
      "Nunca te miente, salvo en una feria.",
      "Te devuelve la mirada.",
      "Refleja tu imagen.",
    ],
    "espejo",
    1,
  ],
  [
    [
      "Te sigue a todas partes.",
      "Es más larga al atardecer.",
      "Desaparece cuando se apaga la luz.",
      "Se forma cuando un cuerpo tapa la luz.",
    ],
    "sombra",
    1,
  ],
  [
    [
      "Tiene manecillas pero no tiene manos.",
      "Puede ser de pared, de pulsera o de arena.",
      "Sin pilas, se queda parado.",
      "Marca la hora.",
    ],
    "reloj",
    1,
  ],
  [
    [
      "Pequeña, de metal y fácil de perder.",
      "Las hay maestras, inglesas y de paso.",
      "Tiene dientes pero no muerde.",
      "Abre una cerradura.",
    ],
    "llave",
    1,
  ],
  [
    [
      "Responde sin que nadie le pregunte.",
      "Le gustan las montañas y las cuevas vacías.",
      "Repite tus últimas palabras.",
      "Sonido que rebota.",
    ],
    "eco",
    2,
  ],
  [
    [
      "Puede ser de barco o de cumpleaños.",
      "Se consume mientras trabaja.",
      "Tiene mecha.",
      "Da luz cuando se va la electricidad.",
    ],
    "vela",
    1,
  ],
  [
    [
      "Puede ser de amor o de un restaurante.",
      "Antes se escribía a mano y tardaba días en llegar.",
      "Necesita sobre y sello.",
      "Mensaje escrito que llega por correo.",
    ],
    "carta",
    1,
  ],
  [
    [
      "Todos tenemos una única e irrepetible.",
      "La dejas sin darte cuenta.",
      "La policía la busca en la escena de un crimen.",
      "Marca que deja la yema del dedo.",
    ],
    "huella",
    2,
  ],
  [
    [
      "Cambia de forma constantemente.",
      "Puede parecer de algodón… o anunciar tormenta.",
      "Flota en el cielo.",
      "Está formada por diminutas gotas de agua.",
    ],
    "nube",
    1,
  ],
  [
    [
      "Si lo cuentas, deja de serlo.",
      "Se guarda sin ocupar espacio.",
      "A veces es «a voces».",
      "Lo que se mantiene oculto.",
    ],
    "secreto",
    2,
  ],
  [
    [
      "Lo rompes al nombrarlo.",
      "Se pide en bibliotecas y hospitales.",
      "Dicen que a veces vale más que mil palabras.",
      "Ausencia total de ruido.",
    ],
    "silencio",
    2,
  ],
  [
    [
      "Tiene cola, pero no es un animal.",
      "Es blanco y negro, pero no es una cebra.",
      "Suele tener 88 teclas.",
      "Instrumento de Chopin y de Mozart.",
    ],
    "piano",
    2,
  ],
  [
    [
      "Tiene palo, pero no es un árbol.",
      "Se baraja.",
      "Hay oros, copas, espadas y bastos.",
      "Cada una de las cartulinas de una baraja.",
    ],
    "naipe|carta",
    2,
  ],
  [
    [
      "Hay reyes que no gobiernan.",
      "Se juega sobre 64 casillas.",
      "Los alfiles se mueven en diagonal.",
      "Juego que termina en jaque mate.",
    ],
    "ajedrez",
    2,
  ],
  [
    [
      "Acerca lo que está lejísimos.",
      "Galileo lo perfeccionó.",
      "Se usa sobre todo de noche.",
      "Sirve para observar los astros.",
    ],
    "telescopio",
    2,
  ],
  [
    [
      "Puede ser negro, blanco o con leche.",
      "Procede de un fruto tropical.",
      "Se derrite con el calor.",
      "Dulce que se vende en tabletas y onzas.",
    ],
    "chocolate",
    1,
  ],
  [
    ["Tiene cadena, pero no está presa.", "Necesita equilibrio.", "Se mueve con pedales.", "Vehículo de dos ruedas."],
    "bicicleta",
    1,
  ],
  [
    [
      "Allí se pide silencio.",
      "Puedes llevarte cosas prestadas.",
      "Hay estanterías y carnés de socio.",
      "Lugar lleno de libros.",
    ],
    "biblioteca",
    1,
  ],
  [
    ["Puede dormir durante siglos.", "Cuando despierta, la tierra tiembla.", "Tiene cráter.", "Expulsa lava."],
    "volcán",
    1,
  ],
  [
    [
      "Te ayuda a no perderte.",
      "Puede ser físico o político.",
      "Tiene escala y leyenda.",
      "Representa un territorio sobre papel.",
    ],
    "mapa",
    1,
  ],
  [
    ["Puede tener pata de palo.", "Busca tesoros enterrados.", "Su bandera lleva una calavera.", "Ladrón del mar."],
    "pirata",
    1,
  ],
  [
    ["Pequeña pero con mucho futuro.", "Hay que enterrarla.", "Necesita agua y sol.", "De ella nace una planta."],
    "semilla",
    2,
  ],
  [
    [
      "Se lleva en la cabeza.",
      "Puede ser de laurel o de espinas.",
      "Los dentistas también la ponen.",
      "Símbolo de los reyes.",
    ],
    "corona",
    2,
  ],
  [
    [
      "Une lo que el agua separa.",
      "Puede ser colgante o levadizo.",
      "En el calendario alarga los festivos.",
      "Construcción para cruzar un río.",
    ],
    "puente",
    2,
  ],
  [
    ["Llega con nubes negras.", "Se oyen truenos.", "Hay relámpagos.", "Lluvia fuerte con aparato eléctrico."],
    "tormenta",
    1,
  ],
  [
    [
      "Dicen que no da la felicidad.",
      "Se gana, se gasta y se ahorra.",
      "Puede ser en efectivo o con tarjeta.",
      "Billetes y monedas.",
    ],
    "dinero",
    1,
  ],
  [
    ["Cambia cada año.", "Tiene doce hojas o más.", "Marca los días festivos.", "Organiza los días del año."],
    "calendario",
    1,
  ],
  [
    [
      "Se dice que atraviesa paredes.",
      "Aparece en las casas encantadas.",
      "En los disfraces va cubierto con una sábana.",
      "Espíritu de un difunto.",
    ],
    "fantasma",
    1,
  ],
  [
    [
      "Se abre y se cierra con un golpe de muñeca.",
      "Muy útil en verano.",
      "Tiene varillas y tela o papel.",
      "Mueve el aire para refrescar.",
    ],
    "abanico",
    2,
  ],
  [
    [
      "Tiene ojos pero no ve.",
      "Crece bajo tierra.",
      "Se come frita, cocida o en tortilla.",
      "Tubérculo que llegó de América.",
    ],
    "patata",
    2,
  ],
  [
    [
      "Tiene agujas pero no cose.",
      "Su sombra es alargada en el bosque.",
      "En Navidad se llena de adornos.",
      "Árbol de hoja perenne con piñas.",
    ],
    "pino|abeto",
    2,
  ],
  [
    [
      "Puede ser de mar o de río.",
      "Hay que esperar a que pique.",
      "Se usa con caña y anzuelo.",
      "Acción de capturar peces.",
    ],
    "pesca",
    2,
  ],
];
