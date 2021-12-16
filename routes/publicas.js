const express = require('express')
const router = express.Router()
const mysql = require('mysql')
var path = require('path')

var pool = mysql.createPool({
  connectionLimit: 20,
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'viajes_db'
})

router.get('/', (req, res) => {
  pool.getConnection((err, cn) => {
    let consulta
    let modificadorConsulta = ""
    let modificadorPagina = ""
    let pagina = 0
    const busqueda = ( req.query.busqueda ) ? req.query.busqueda : ""
    if (busqueda != ""){
      modificadorConsulta = `
        WHERE
        titulo LIKE '%${busqueda}%' OR
        resumen LIKE '%${busqueda}%' OR
        contenido LIKE '%${busqueda}%'
      `
      modificadorPagina = ""
    }
    else{
      pagina = ( req.query.pagina ) ? parseInt(req.query.pagina) : 0
      if (pagina < 0) {
        pagina = 0
      }
      modificadorPagina = `
        LIMIT 5 OFFSET ${pagina*5}
      `
    }
    consulta = `
      SELECT
      publicaciones.id id, titulo, resumen, fecha_hora, pseudonimo, votos, avatar
      FROM publicaciones
      INNER JOIN autores
      ON publicaciones.autor_id = autores.id
      ${modificadorConsulta}
      ORDER BY fecha_hora DESC
      ${modificadorPagina}
    `
    cn.query(consulta, (error, filas, campos) => {
      res.render('index', { publicaciones: filas , busqueda: busqueda, pagina: pagina})
    })
    cn.release()
  })
})

router.get('/registro', (req, res) => {
  res.render('registro', { mensaje: req.flash('mensaje') })
})

router.post('/procesar_registro', (req, res) => {
  pool.getConnection((err, cn) => {
    const email = req.body.email.toLowerCase().trim()
    const pseudonimo = req.body.pseudonimo.trim()
    const contrasena = req.body.contrasena
    const consultaEmail = `
      SELECT *
      FROM autores
      WHERE email = ${cn.escape(email)}
    `
    cn.query(consultaEmail, (error, filas, campos) => {
      if (filas.length > 0) {
        req.flash('mensaje', 'Email duplicado')
        res.redirect('/registro')
      }
      else {
        const consultaPseudonimo = `
          SELECT *
          FROM autores
          WHERE pseudonimo = ${cn.escape(pseudonimo)}
        `
        cn.query(consultaPseudonimo, (error, filas, campos) => {
          if (filas.length > 0) {
            req.flash('mensaje', 'Pseudonimo duplicado')
            res.redirect('/registro')
          }
          else {
            const consulta = `
                                INSERT INTO
                                autores
                                (email, contrasena, pseudonimo)
                                VALUES (
                                  ${cn.escape(email)},
                                  ${cn.escape(contrasena)},
                                  ${cn.escape(pseudonimo)}
                                )
                              `
            cn.query(consulta, (error, filas, campos) => {
              if (req.files && req.files.avatar){
                const archivoAvatar = req.files.avatar
                const id = filas.insertId
                const nombreArchivo = `${id}${path.extname(archivoAvatar.name)}`
                archivoAvatar.mv(`./public/avatars/${nombreArchivo}`, (error) => {
                  const consultaAvatar = `
                                UPDATE
                                autores
                                SET avatar = ${cn.escape(nombreArchivo)}
                                WHERE id = ${cn.escape(id)}
                              `
                  cn.query(consultaAvatar, (error, filas, campos) => {
                    req.flash('mensaje', 'Usuario registrado con avatar')
                    res.redirect('/registro')
                  })
                })
              }
              else{
                req.flash('mensaje', 'Usuario registrado')
                res.redirect('/registro')
              }
            })
          }
        })
      }
    })
    cn.release()
  })
})

router.get('/inicio', (req, res) => {
  res.render('inicio', { mensaje: req.flash('mensaje') })
})

router.post('/procesar_inicio', (req, res) => {
  pool.getConnection((err, cn) => {
    const consulta = `
      SELECT *
      FROM autores
      WHERE
      email = ${cn.escape(req.body.email)} AND
      contrasena = ${cn.escape(req.body.contrasena)}
    `
    cn.query(consulta, (error, filas, campos) => {
      if (filas.length > 0) {
        req.session.usuario = filas[0]
        res.redirect('/admin/index')
      }
      else {
        req.flash('mensaje', 'Datos inválidos')
        res.redirect('/inicio')
      }
    })
    cn.release()
  })
})

router.get('/publicacion/:id', (req, res) => {
  pool.getConnection((err, cn) => {
    const consulta = `
      SELECT *
      FROM publicaciones
      WHERE id = ${cn.escape(req.params.id)}
    `
    cn.query(consulta, (error, filas, campos) => {
      if (filas.length > 0) {
        res.render('publicacion', { publicacion: filas[0] })
      }
      else {
        res.redirect('/')
      }
    })
    cn.release()
  })
})

router.get('/autores', (req, res) => {
  pool.getConnection((err, cn) => {
    const consulta = `
      SELECT autores.id id, pseudonimo, avatar, publicaciones.id publicacion_id, titulo
      FROM autores
      INNER JOIN
      publicaciones
      ON
      autores.id = publicaciones.autor_id
      ORDER BY autores.id DESC, publicaciones.fecha_hora DESC
    `
    cn.query(consulta, (error, filas, campos) => {
      autores = []
      ultimoAutorId = undefined
      filas.forEach(registro => {
        if (registro.id != ultimoAutorId){
          ultimoAutorId = registro.id
          autores.push({
            id: registro.id,
            pseudonimo: registro.pseudonimo,
            avatar: registro.avatar,
            publicaciones: []
          })
        }
        autores[autores.length-1].publicaciones.push({
          id: registro.publicacion_id,
          titulo: registro.titulo
        })
      });
      res.render('autores', { autores: autores })
    })


    cn.release()
  })
})

router.get('/publicacion/:id/votar', (req,res)=>{
  pool.getConnection((error,cn)=>{
    const consulta = `SELECT * FROM publicaciones WHERE id = ${cn.escape(req.params.id)}`;
    cn.query(consulta,(err,filas,campos)=>{
      if (filas.length > 0) {
        const consultaVoto = `UPDATE publicaciones 
        SET votos = votos + 1 
        WHERE id = ${cn.escape(req.params.id)}`

        cn.query(consultaVoto, (err,filas,campos)=>{
          res.redirect(`/publicacion/${req.params.id}`)
        })

      } else {
        req.flash('mensaje', 'Publicacion invalida')
      }
    })
    cn.release();
  })
})

module.exports = router
