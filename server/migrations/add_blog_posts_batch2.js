import { query } from '../db.js';

export async function addBlogPostsBatch2() {
    // La tabla ya se crea en add_blog_posts.js; este IF NOT EXISTS la deja
    // segura para correr en aislamiento.
    await query(`
        CREATE TABLE IF NOT EXISTS blog_posts (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            slug             TEXT NOT NULL UNIQUE,
            title            TEXT NOT NULL,
            excerpt          TEXT,
            content_md       TEXT,
            cover_image_url  TEXT,
            author           TEXT NOT NULL DEFAULT 'DobleYo Café',
            reading_time_min INTEGER DEFAULT 3,
            tags             TEXT,
            is_published     INTEGER NOT NULL DEFAULT 0,
            published_at     TIMESTAMP NULL,
            created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP NULL
        )
    `);

    const posts = [
        {
            slug: 'cafe-narino',
            title: 'Nariño: el café que crece donde casi no debería',
            excerpt: 'En Nariño los cafetales suben hasta donde otros cultivos ya se rinden. Esa terquedad de la montaña es justo lo que vuelve esta taza tan especial.',
            content_md: `Cada vez que abrimos un saco de Nariño me acuerdo de la primera vez que vi una de esas fincas en fotos: cafetales casi colgados de la montaña, en pendientes donde uno se pregunta cómo hace la gente para recoger el grano sin rodar ladera abajo. Y sin embargo ahí está, creciendo a alturas en las que muchos otros cultivos ya tiraron la toalla.\n\nEsa es la primera cosa que hay que entender de Nariño: es café de altura extrema. Hay fincas por encima de los **2.000 metros**, algo que en casi cualquier otra parte del mundo sería impensable porque haría demasiado frío. Pero Nariño está tan cerca del Ecuador que la cercanía a la línea ecuatorial compensa el frío de la altura. Es una de esas casualidades de la geografía que terminan en tu taza.\n\n## ¿Y eso qué cambia en el sabor?\n\nMucho. Mientras más alto y más frío, más lento madura el grano. Y entre más lento madura, más azúcares concentra. Por eso un buen Nariño te llega con una **dulzura notable**, una acidez viva tipo cítrico y un cuerpo que se siente redondo sin ser pesado. No es un café tímido.\n\nA mí me gusta describirlo como un café "limpio y brillante". Cuando lo pruebas al lado de un Huila, por ejemplo, el Huila te coquetea con durazno y miel, mientras el Nariño se va más hacia lo cítrico y floral, con una chispa de panela al final. Ninguno es mejor; son conversaciones distintas.\n\n## Detrás de la taza hay manos\n\nVale la pena decirlo sin romanticismo barato: ese café crece en fincas pequeñas, familiares, en laderas donde casi todo se hace a mano porque ninguna máquina sube ahí. La recolección es selectiva, grano por grano, escogiendo solo el cereza maduro. Eso no es marketing, es trabajo duro, y es buena parte de por qué Nariño aparece tan seguido entre los cafés más premiados del país.\n\n## Cómo le sacas el jugo en casa\n\nSi te llevas un Nariño, trátalo como lo que es: un café para métodos que dejen brillar la claridad.\n\n- **V60 o Chemex** son sus mejores amigos. Resaltan esa acidez limpia y los tonos florales.\n- Si lo haces en **prensa francesa**, vas a ganar cuerpo pero perder un poco de definición. No está mal, es otro gusto.\n- Evita ahogarlo en leche. Un Nariño con mucha leche es como ponerle sordina a un buen instrumento.\n\nLa próxima vez que tomes uno, párate un segundo antes del primer sorbo y piensa en la montaña empinada de donde salió. Sabe distinto cuando sabes de dónde viene.`,
            cover_image_url: 'https://images.unsplash.com/photo-1459755486867-b55449bb39ff?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 5,
            tags: JSON.stringify(['origen', 'narino', 'cata']),
            is_published: 1,
            published_at: new Date('2026-05-12T13:00:00Z').toISOString(),
        },
        {
            slug: 'greca-en-casa',
            title: 'La greca de la casa: cómo sacarle un buen café al método más nuestro',
            excerpt: 'Casi todas las cocinas colombianas tienen una greca arrumada por ahí. No es un método de segunda: bien usada, da un café con carácter. Aquí te cuento cómo.',
            content_md: `Hay un pequeño esnobismo en el mundo del café de especialidad que me molesta: tratar la greca como si fuera un método de segunda categoría. La greca —esa cafetera de aluminio que se enrosca por la mitad y que tu abuela tenía en la estufa— es probablemente la forma en la que más colombianos toman café en casa. Y la verdad es que, bien usada, te da una taza intensa, con cuerpo y mucho carácter.\n\nNo es V60 ni pretende serlo. La greca extrae a presión, así que te da algo más cercano a un espresso fuerte que a un café filtrado. Eso no es un defecto, es su personalidad. El problema es que casi todo el mundo la usa mal y termina con un café amargo y quemado, y luego le echa la culpa al método.\n\n## Los tres errores de siempre\n\nAntes de la receta, hablemos de lo que casi seguro estás haciendo mal, porque yo lo hacía:\n\n1. **Llenar el agua hasta arriba.** El nivel del agua no debe pasar la válvula de seguridad. Si la tapas, es peligroso y además sale mal.\n2. **Apretar el café en el filtro.** No es espresso de máquina. El café va suelto, nivelado, sin presionar. Si lo aprietas, el agua no pasa bien.\n3. **Dejarla en candela hasta el final.** Ese borboteo violento al final es el que te quema el café y te deja ese amargor metálico tan feo.\n\n## La receta que sí funciona\n\n- Echa **agua caliente** (sí, caliente, no fría) en la base, hasta justo debajo de la válvula. Usar agua ya caliente evita que el café se "cocine" mientras la greca se calienta.\n- Llena el filtro de café molido **fino, como sal de mesa**, sin apretar. Empareja con el dedo.\n- Enrosca y ponla a **fuego medio-bajo**. Nada de candela a tope con afán.\n- Quédate cerca. Cuando empiece a salir el café y escuches el primer "gluglú", **bájale al mínimo**.\n- En cuanto el chorro pase de café oscuro a un color más claro y rubio, **retírala del fuego de una vez.** Esa parte clara final es pura amargura.\n\nUn truco de abuela que sí sirve: cuando la retiras, ponle la base un momento bajo el chorro del agua fría del grifo. Corta la cocción de golpe y evita que se siga quemando con el calor residual.\n\n## Un buen grano también en la greca\n\nNo necesitas guardar el café de especialidad solo para el filtrado de domingo. Un café de origen, recién molido, en la greca, te sorprende. Eso sí: muele justo antes, porque la greca perdona poco y un café viejo se nota al instante.\n\nLa greca no es el pariente pobre de las cafeteras bonitas. Es parte de cómo aprendimos a tomar café en este país. Solo había que tratarla con un poquito más de cuidado.`,
            cover_image_url: 'https://images.unsplash.com/photo-1521302080334-4bebac2763a6?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 5,
            tags: JSON.stringify(['preparacion', 'greca', 'casa']),
            is_published: 1,
            published_at: new Date('2026-05-26T13:00:00Z').toISOString(),
        },
        {
            slug: 'procesos-lavado-honey-natural',
            title: 'Lavado, honey o natural: lo que le pasa al café antes de llegar a tu taza',
            excerpt: 'En la etiqueta dice "honey" o "natural" y suena a chino. Pero ese paso, que ocurre en la finca, define buena parte de lo que vas a saborear. Te lo explico fácil.',
            content_md: `Cuando alguien lee en nuestra bolsa la palabra "honey" o "natural", casi siempre pregunta lo mismo: "¿eso qué quiere decir?". Y es una excelente pregunta, porque ese detalle —que pasa en la finca, mucho antes del tueste— define buena parte de lo que vas a saborear. Tanto, que el mismo grano de la misma finca puede saber a dos cosas distintas según cómo se procese.\n\nDejame explicarte sin tecnicismos. El café que tomas es la semilla de una fruta. Sí, una fruta: la cereza de café, roja y dulce. Para llegar al grano hay que quitarle esa pulpa, y la forma de hacerlo es lo que llamamos "proceso". Hay tres caminos principales.\n\n## Lavado\n\nEs el más común en Colombia y el más "tradicional". A la cereza se le quita la pulpa, se fermenta el grano en tanques con agua para soltar el mucílago pegajoso, y luego se lava bien.\n\n¿Resultado en la taza? Un café **limpio, definido, brillante**. La acidez se siente clara y el origen habla sin ruido de fondo. Si quieres entender de verdad cómo sabe una región, el lavado es la versión más transparente.\n\n## Honey\n\nAquí no se lava todo. Se le quita la cáscara pero se deja parte del mucílago —esa capa dulce y pegajosa— sobre el grano mientras se seca al sol. El nombre viene de lo pegajoso que queda, no de que sepa a miel (aunque a veces lo parezca).\n\n¿Resultado? Más **dulzura y más cuerpo** que un lavado, con una acidez un poco más suave y redonda. Es como subirle el volumen a la parte dulce sin perder el origen.\n\n## Natural\n\nEl más antiguo de todos y el que está más de moda en especialidad. La cereza **entera** se seca al sol, con pulpa y todo, y solo después se descascara. El grano pasa días absorbiendo los azúcares de la fruta.\n\n¿Resultado? Una taza **frutal, intensa, casi a fermentado**, con notas que recuerdan a fresa, vino o frutos rojos maduros. Es el más arriesgado y el que más divide opiniones: o lo amas o te parece raro. A mí me parece fascinante.\n\n## Una tabla para no perderte\n\n| Proceso | Lo que aporta | Si te gusta… |\n|---------|---------------|--------------|\n| Lavado | Claridad y acidez limpia | Un café equilibrado y nítido |\n| Honey | Dulzura y cuerpo | Algo redondo, sin filos |\n| Natural | Fruta intensa y carácter | Sabores que sorprenden |\n\n## ¿Cuál es el mejor?\n\nNinguno. En serio. No hay un proceso superior, hay procesos distintos para gustos distintos y momentos distintos. Lo bonito es probarlos a conciencia: compra el mismo origen en lavado y en natural, prepáralos igual, y siéntelos lado a lado. Ahí se te abre la cabeza y entiendes de un golpe lo que tres párrafos no alcanzan a explicar.\n\nLa próxima vez que veas esa palabrita en la etiqueta, ya no es chino. Es una pista de lo que te espera.`,
            cover_image_url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 6,
            tags: JSON.stringify(['origen', 'procesos', 'cata']),
            is_published: 1,
            published_at: new Date('2026-06-09T13:00:00Z').toISOString(),
        },
        {
            slug: 'del-tinto-al-especialidad',
            title: 'Del tinto de la esquina al café de especialidad (sin traicionar a nadie)',
            excerpt: 'Tomar café de especialidad no significa renegar del tinto de toda la vida. Es más bien volverse curioso. Te cuento cómo hacer el salto sin volverte insoportable.',
            content_md: `Tengo que confesar algo: yo crecí con tinto. Tinto de greca en la mañana, tinto en termo en los paseos, tinto en pocillo pequeño donde el tendero de la esquina, ese que se sabe el pedido de todo el barrio de memoria. El tinto no es solo café; es una forma de parar, de saludar, de hacer una pausa. Y por nada del mundo voy a hablar mal de él.\n\nPor eso me da un poco de rabia cuando el café de especialidad se vende como si fuera lo contrario del tinto. Como si para tomar un buen café de origen tuvieras que renegar de tus raíces y mirar por encima del hombro al pocillo de la esquina. No es así, o no debería serlo.\n\n## ¿Entonces qué es lo "especial"?\n\nLa diferencia no es de clase social, es de información y de cuidado. El café de especialidad, básicamente, es café al que se le puede seguir el rastro: se sabe de qué finca viene, a qué altura creció, cómo se procesó y cómo se tostó. Y en cada uno de esos pasos alguien tomó decisiones para cuidar el sabor en lugar de esconder defectos.\n\nMucho del café tradicional, en cambio, se tuesta bien oscuro justamente para emparejar todo y tapar lo que no estaba tan bueno. Por eso el tinto clásico tiende a saber parecido venga de donde venga: el tueste oscuro y el azúcar mandan. No es malo. Es otra cosa.\n\n## Cómo dar el salto sin volverte insoportable\n\nPorque sí existe el riesgo de convertirse en ese personaje pesado que corrige a todo el mundo sobre cómo deberían tomar el café. No seas ese. Mejor:\n\n- **Empieza por probar sin azúcar.** Solo una taza, para sentir a qué sabe el café de verdad. Si después le echas azúcar, perfecto, pero al menos ya sabes qué hay debajo.\n- **Quédate con un origen y conócelo.** En vez de saltar de moda en moda, toma un par de semanas el mismo café y aprende a reconocerlo. Eso entrena el paladar más que cualquier curso.\n- **No botes la greca ni el termo.** El método tradicional sigue sirviendo. Un buen grano en greca es una gran puerta de entrada.\n- **Comparte, no sermonees.** La mejor forma de "convertir" a alguien es darle a probar una taza rica, no darle una conferencia.\n\n## Curiosidad, no traición\n\nAl final, pasar del tinto al especialidad no es cambiar de bando. Es volverse curioso por algo que siempre tuviste enfrente. Es preguntarte de dónde salió ese grano, quién lo recogió, por qué este sabe a panela y aquel a mandarina.\n\nEl tinto de la esquina te enseñó a querer el café. El de especialidad solo te invita a conocerlo un poco mejor. Y eso, lejos de ser una traición, es la mejor forma de honrarlo.`,
            cover_image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 5,
            tags: JSON.stringify(['cultura', 'tinto', 'especialidad']),
            is_published: 1,
            published_at: new Date('2026-06-16T13:00:00Z').toISOString(),
        },
        {
            slug: 'dia-de-cosecha',
            title: 'Un día de cosecha: lo que cuesta cada grano que te tomas',
            excerpt: 'Detrás de esa taza de la mañana hay madrugadas en la montaña, canastos al hombro y manos que escogen grano por grano. Vale la pena conocer ese trabajo.',
            content_md: `Es fácil olvidar, mientras uno revuelve el café con cara de sueño a las seis de la mañana, que ese grano vino de algún lado. Y no de una fábrica: vino de una montaña, y de las manos de alguien que también madrugó, pero mucho más que tú.\n\nQuiero contarte cómo es un día de cosecha, no para ponerle drama, sino porque creo que el café sabe distinto cuando uno sabe lo que costó.\n\n## Arranca antes de que salga el sol\n\nEn las fincas de café la jornada empieza temprano, con el frío todavía pegado a la montaña. Los recolectores —muchas veces familias enteras, a veces cuadrillas que viajan de finca en finca siguiendo las cosechas— se cuelgan el canasto a la cintura y se meten al cafetal. En las laderas empinadas de Nariño o el Huila eso significa caminar en pendientes donde uno apenas se sostiene de pie.\n\n## El secreto está en escoger\n\nAquí viene lo que mucha gente no sabe: en el café bueno, **no se recoge todo de una vez**. Una misma rama tiene cerezas verdes, pintonas y rojas maduras al tiempo. El recolector escoge **solo las rojas**, las que están en su punto, y deja las demás para volver días después.\n\nEso se llama recolección selectiva, y es lentísimo. Es la diferencia entre un café de especialidad y uno corriente, donde se "ordeña" la rama entera sin importar el punto de madurez. Cada grano rojo que escoges es un grano que sabrá dulce; cada verde que se cuela, un amargor en la taza de alguien.\n\n## Lo que pesa un canasto\n\nUn recolector experimentado puede llenar varios canastos al día, pero no es plata fácil. Se paga por kilo de cereza recogida, y para llenar un solo kilo de café como el que tú compras tostado hicieron falta muchísimas más cerezas, porque entre la pulpa, el secado y la trilla el grano pierde la mayor parte de su peso.\n\nPónlo así: ese paquete de café que te dura una o dos semanas representa horas de alguien agachado en una ladera, grano por grano, bajo el sol o la llovizna.\n\n## Por qué te lo cuento\n\nNo para que te sientas culpable mientras te tomas el café —eso no le sirve a nadie—. Te lo cuento por dos razones bien concretas.\n\nLa primera, para que entiendas por qué un café de especialidad cuesta lo que cuesta. No es un capricho de etiqueta bonita: es trabajo humano cuidadoso que alguien tiene que pagar de forma justa para que valga la pena hacerlo bien.\n\nLa segunda, más simple: porque el café se disfruta distinto cuando lo respetas. Mañana, cuando tomes el primero del día, regálale tres segundos de atención. Piensa en la montaña, en el frío de la madrugada, en las manos que escogieron ese grano rojo entre cientos. Y luego sí, tómatelo con calma.\n\nSe lo ganó. Y tú también.`,
            cover_image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 5,
            tags: JSON.stringify(['origen', 'cosecha', 'caficultores']),
            is_published: 1,
            published_at: new Date('2026-06-23T13:00:00Z').toISOString(),
        },
    ];

    for (const p of posts) {
        await query(
            `INSERT INTO blog_posts (slug, title, excerpt, content_md, cover_image_url, reading_time_min, tags, is_published, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (slug) DO UPDATE SET
                title            = excluded.title,
                excerpt          = excluded.excerpt,
                content_md       = excluded.content_md,
                cover_image_url  = excluded.cover_image_url,
                reading_time_min = excluded.reading_time_min,
                tags             = excluded.tags,
                is_published     = excluded.is_published,
                updated_at       = datetime('now')`,
            [p.slug, p.title, p.excerpt, p.content_md, p.cover_image_url, p.reading_time_min, p.tags, p.is_published, p.published_at]
        );
    }

    console.log('[Migration] blog_posts: 5 posts adicionales sembrados.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    import('dotenv/config').then(() =>
        addBlogPostsBatch2()
            .then(() => { console.log('OK'); process.exit(0); })
            .catch(err => { console.error(err); process.exit(1); })
    );
}
