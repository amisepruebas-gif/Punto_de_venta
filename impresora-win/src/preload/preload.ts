// Puente seguro: lo único que la ventana puede pedirle al proceso principal.
import { contextBridge, ipcRenderer } from "electron";
import type { AccionBandeja, ApiAmise } from "../compartido/api";

const api: ApiAmise = {
  opciones: () => ipcRenderer.invoke("opciones"),
  vinculacion: {
    leer: () => ipcRenderer.invoke("vinculacion:leer"),
    guardar: (codigo) => ipcRenderer.invoke("vinculacion:guardar", codigo),
    borrar: () => ipcRenderer.invoke("vinculacion:borrar"),
  },
  config: {
    leer: () => ipcRenderer.invoke("config:leer"),
    guardar: (cambios) => ipcRenderer.invoke("config:guardar", cambios),
  },
  impresoras: {
    listar: () => ipcRenderer.invoke("impresoras:listar"),
    puertosUsb: () => ipcRenderer.invoke("impresoras:puertos"),
    revisarPuerto: (impresora) => ipcRenderer.invoke("impresoras:revisarPuerto", impresora),
    preparar: (puerto) => ipcRenderer.invoke("impresoras:preparar", puerto),
    imprimir: (p) => ipcRenderer.invoke("impresoras:imprimir", p),
  },
  ventana: {
    mostrar: () => ipcRenderer.send("ventana:mostrar"),
    ocultar: () => ipcRenderer.send("ventana:ocultar"),
  },
  estadoBandeja: (e) => ipcRenderer.send("bandeja:estado", e),
  alPedirBandeja: (cb) => {
    const f = (_e: unknown, accion: AccionBandeja) => cb(accion);
    ipcRenderer.on("bandeja:accion", f);
    return () => {
      ipcRenderer.removeListener("bandeja:accion", f);
    };
  },
  alCambiarDispositivos: (cb) => {
    const f = () => cb();
    ipcRenderer.on("dispositivos:cambiaron", f);
    return () => {
      ipcRenderer.removeListener("dispositivos:cambiaron", f);
    };
  },
  avisar: (a) => ipcRenderer.send("aviso:mostrar", { titulo: a.titulo, texto: a.texto }),
  registro: (nivel, mensaje) => ipcRenderer.send("registro", nivel, mensaje),
};

contextBridge.exposeInMainWorld("amise", api);
