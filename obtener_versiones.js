#!/usr/bin/env node
// Este script se encarga de obtener las versiones actuales
// de los repectivos packages.json del front y del back. Despues,
// retorna una salida de texto con el formato "x.x.x|x.x.x"
// El error no se captura para que el bash lo detecte?

// const api_path = process.env.api_path;
const gui_path = process.env.gui_path;


// const api = require(`./${api_path}/package.json`).version;
const gui = require(`./package.json`).version;

// The script must be obtain the result from this console.log. 
// console.log( api+'|'+gui);
console.log(gui);
