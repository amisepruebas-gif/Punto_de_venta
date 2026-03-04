package descarga_init;

import static com.example.nodo_1.editar_articulos.generarID;
import static com.example.nodo_1.fire.db;
import static com.example.nodo_1.fire.documenRef;
import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.getAnñoMesDiaHora;
import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.quitarCero;
import static com.example.nodo_1.generales.removeData_sharedPreferences;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonCorteHistorial;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonMensajes;
import static com.example.nodo_1.principal.jsonMensajes_n;
import static com.example.nodo_1.principal.jsonPedido;
import static com.example.nodo_1.principal.jsonSiglas;
import static com.example.nodo_1.principal.jsonVenta;
import static com.example.nodo_1.principal.jsonVentaXarticulo;
import static com.example.nodo_1.principal.objectFechasCorte;
import static com.example.nodo_1.principal.objectFechasMensaje;
import static com.example.nodo_1.principal.objectFechasVenta;
import static com.example.nodo_1.principal.unaVezHiloEscuchar;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.example.nodo_1.R;
import com.example.nodo_1.fecha;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.firestore.CollectionReference;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.QuerySnapshot;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import modulos_descarga.articulos;
import modulos_descarga.mensajes;
import modulos_descarga.notificacionAjustes;

public class descarga {
    public static String    huellaArticulos_reset   = "";
    Context context;
    com.example.nodo_1.principal principal;
    int intDescargarDatos = 0;
    boolean estadoInternetet;
    private static boolean decargarTodo = false;
    public static boolean unaVezNotificacionAjustes = true;

    public static boolean unavezArt = true;
    public descarga(Context context, principal principal, boolean estadoInternetet){
        this.context            = context;
        this.principal          = principal;
        this.estadoInternetet   = estadoInternetet;
    }
    public void descargarTodo(){
        decargarTodo = true;
        descargarDatos_Seccion_descargarTodo();
        descargarArticulos(false);
        descargarClientes();
        descargarApartados();
        descargarVentaArticulo();
        descargarJSON_Venta_MensajesTodo("mensajes_n");
        descargarJSON_Venta_MensajesTodo("ventas_n");

        if (!unaVezHiloEscuchar){
            unaVezHiloEscuchar = true;
            escucharDatos();
        }
        // descarga de datos despues de ventas y mensajes
    }
    public void descargaInit(){
        if(estadoInternetet){
            if (getJsonGuardado("jsonVentaXarticulo")!=null){
                jsonVentaXarticulo = getJsonGuardado("jsonVentaXarticulo");
            }else  descargarVentaArticulo();
            if (getJsonGuardado("jsonClientes")!=null){
                jsonClientes = getJsonGuardado("jsonClientes");
            }else descargarClientes();
            if (getJsonGuardado("jsonPedido")!=null){
                jsonPedido = getJsonGuardado("jsonPedido");
            }else descargarApartados();
            if (getJsonGuardado("jsonVenta")!=null){
                jsonVenta = getJsonGuardado("jsonVenta");
                if (getJsonGuardado("objectFechasVenta")!=null){
                    objectFechasVenta = getJsonGuardado("objectFechasVenta");
                }else descargar_solo_Fechas("ventas_n");
            }else descargarJSON_hechoporfechas("ventas_n");
            if (getJsonGuardado("jsonCorteHistorial")!=null){
                jsonCorteHistorial =getJsonGuardado("jsonCorteHistorial");

            }
            descargar_solo_Fechas("jsonCorteHistorial");
        }else {
            String primeravez_disp_nuevo = loadData_sharedPreferences(
                    context,
                    context.getString(R.string.primeraVez_disp_nuevo),
                    context.getString(R.string.primeraVez_disp_nuevo));
            if(!primeravez_disp_nuevo.equals("")){
                if (getJsonGuardado("objectFechasMensaje")!=null){
                    objectFechasMensaje = getJsonGuardado("objectFechasMensaje");
                }else toast("ERROR E1 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("objectFechasVenta")!=null){
                    objectFechasVenta = getJsonGuardado("objectFechasVenta");
                }else toast("ERROR E2 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("jsonArticulos")!=null){
                    jsonArticulos = getJsonGuardado("jsonArticulos");
                    initArticulos();
                }else toast("ERROR E3 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("jsonVenta")!=null){
                    jsonVenta = getJsonGuardado("jsonVenta");
                }else toast("ERROR E4 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("jsonMensajes_n")!=null){
                    jsonMensajes_n = getJsonGuardado("jsonMensajes_n");
                }else toast("ERROR E5 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("jsonVentaXarticulo")!=null){
                    jsonVentaXarticulo = getJsonGuardado("jsonVentaXarticulo");
                }else toast("ERROR E6 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("jsonClientes")!=null){
                    jsonClientes = getJsonGuardado("jsonClientes");
                }else toast("ERROR E7 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("jsonPedido")!=null){
                    jsonPedido = getJsonGuardado("jsonPedido");
                }else toast("ERROR E8 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
                if (getJsonGuardado("jsonDatos")!=null){
                    jsonDatos = getJsonGuardado("jsonDatos");
                }else toast("ERROR E9 PRESIONE EL BOTON ACATUALIZAR UBICADO EN EL ADMINISTRADOR");
            }else {
                toast("NO HAY CONEXIÓN A INTERNET");
                toast("NINGIN DATO DESCARGADO");
            }
        }
        descargarDatos();
    }
    static public boolean escucharTicketInformacion         = false;
    static public boolean escucharDatosTransferencia        = false;
    static public boolean escucharMsotrarBut_Tarjeta        = false;
    static public boolean escucharMsotrarBut_Transferencia  = false;
    static public boolean escucharMostrar3x2                = false;
    static public boolean escucharCobrarComsion             = false;
    static public boolean escucharDarTicket                 = false;
    static public boolean escucharFacial                    = false;
    static public boolean escucharLimitarExistencia         = false;
    static public boolean escucharNombreCorte               = false;
    static public boolean escucharEquipoDeTrabajo           = false;
    static public boolean escucharPasAdmin                  = false;
    static public boolean escucharTallas                    = false;



    private void intentet(String s, JSONObject object){
        if(s.equals(context.getString(R.string.mostrarBotonPagoTarjeta))){

            actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_mostrarBotonPagoTarjeta");
            intent.putExtra("datos", "mostrarBotonPagoTarjeta");  // 'data' es el dato actualizado de Firestore
            intent.putExtra("extra_data", object.toString());  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.mostrarBotonTransferencia))){

            actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_mostrarBotonTransferencia");
            intent.putExtra("datos", context.getString(R.string.mostrarBotonTransferencia));  // 'data' es el dato actualizado de Firestore
            intent.putExtra("extra_data", object.toString());  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.val_2x1_mostrar))){

            actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_3x2");
            intent.putExtra("datos", context.getString(R.string.val_2x1_mostrar));  // 'data' es el dato actualizado de Firestore
            intent.putExtra("extra_data", object.toString());  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.dar_ticket))){

            actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_dar_ticket");
            intent.putExtra("datos",  context.getString(R.string.dar_ticket));  // 'data' es el dato actualizado de Firestore
            intent.putExtra("extra_data", object.toString());  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.cobrar_comision))){

            actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_cobrar_comision");
            intent.putExtra("datos", context.getString(R.string.cobrar_comision));  // 'data' es el dato actualizado de Firestore
            intent.putExtra("extra_data", object.toString());  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.statusFacial))){

            actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_facial");
            intent.putExtra("datos", context.getString(R.string.statusFacial));  // 'data' es el dato actualizado de Firestore
            intent.putExtra("extra_data", object.toString());  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.limitarVenta_a_existencia))){

            actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_limitarVenta_a_existencia");
            intent.putExtra("datos", context.getString(R.string.limitarVenta_a_existencia));  // 'data' es el dato actualizado de Firestore
            intent.putExtra("extra_data", object.toString());  // 'data' es el dato actualizado de Firestore
            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);

        }else if(s.equals(context.getString(R.string.mostrarBotonTransferencia))){

        }

    }
    private void setNodo_recibido(String key, String estado){
        JSONObject objNodo = new JSONObject();
        try {

            if(key.equals(context.getString(R.string.datosTicket))){
                objNodo.put(context.getString(R.string.datosTicket), "DATOS TICKET ACTUALIZADOS");

            } else if(key.equals(context.getString(R.string.transferencia_datos))){
                objNodo.put(context.getString(R.string.transferencia_datos), "DATOS TRANSFERENCIA ACTUALIZADOS");

            } else if(key.equals(context.getString(R.string.mostrarBotonPagoTarjeta))){
                objNodo.put(context.getString(R.string.mostrarBotonPagoTarjeta), "BOTON ACTUALIZADO");

            } else if(key.equals(context.getString(R.string.mostrarBotonTransferencia))){
                objNodo.put(context.getString(R.string.mostrarBotonTransferencia), "BOTON ACTUALIZADO");

            } else if(key.equals(context.getString(R.string.val_2x1_mostrar))){
                objNodo.put(context.getString(R.string.val_2x1_mostrar), "3x2 BOTON ACTUALIZADO");

            } else if(key.equals(context.getString(R.string.cobrar_comision))){
                objNodo.put(context.getString(R.string.cobrar_comision), "COBRAR COMISION, ACTUALIZADO");

            } else if(key.equals(context.getString(R.string.dar_ticket))){
                objNodo.put(context.getString(R.string.dar_ticket), "DAR TICKET, ACTUALIZADO");

            } else if(key.equals(context.getString(R.string.statusFacial))){
                objNodo.put(context.getString(R.string.statusFacial), "FACIAL, ACTUALIZADO");

            } else if (key.equals(context.getString(R.string.limitarVenta_a_existencia))) {
                objNodo.put(context.getString(R.string.limitarVenta_a_existencia), "LIMITAR VENTA A EXISTENCIA, ACTUALIZADO");

            } else if (key.equals(context.getString(R.string.nombresCorte))) {
                objNodo.put(context.getString(R.string.nombresCorte), "NOMBRES CORTE, ACTUALIZADO");

            } else if (key.equals(context.getString(R.string.passAdmin))){
                objNodo.put(context.getString(R.string.passAdmin), "CONTRASEÑA ACTUALIZADA");

            } else if (key.equals(context.getString(R.string.tallas))){
                objNodo.put(context.getString(R.string.tallas), "TALLAS ACTUALIZADA");
            }
            objNodo.put("id", generarID());
            objNodo.put("estado", estado);
            /*
            fire.documenRef("datos/" + context.getString(R.string.recibido_nodo)).
                    set(new Gson().fromJson(
                            objNodo.toString(), HashMap.class));
             */
        } catch (JSONException ex) {
            throw new RuntimeException(ex);
        }
    }

    public void escucharDatos(){


        jsonVenta           = getJsonGuardado("jsonVenta");


        DocumentReference documentRef = db().document("datos" + "/" + context.getString(R.string.datosTicket));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.datosTicket));return;}
                if (!escucharTicketInformacion) {
                    escucharTicketInformacion = true;
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    try {
                        generales.saveData_sharedPreferences(
                                context,
                                context.getString(R.string.datosTicket),
                                context.getString(R.string.datosTicket),
                                object.getString(context.getString(R.string.datosTicket)));

                        jsonDatos.put(context.getString(R.string.datosTicket), object);
                        actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);

                        unavezRecibidoNodo = false;
                        setNodo_recibido(context.getString(R.string.datosTicket), "1");
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
        documentRef = db().document("datos" + "/" + context.getString(R.string.transferencia_datos));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {

                if (e != null) {toast("error desc escDatos " + context.getString(R.string.transferencia_datos)); return;}
                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    try {
                        generales.saveData_sharedPreferences(context,  context.getString(R.string.transferencia_datos),
                                context.getString(R.string.transferencia_datos),object.getString(context.getString(R.string.transferencia_datos)));


                        jsonDatos.put(context.getString(R.string.transferencia_datos),
                               new JSONObject(object.getString(context.getString(R.string.transferencia_datos))));
                        principal.infoPago_trans();
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });

        documentRef = db().document("datos" + "/" + context.getString(R.string.mostrarBotonPagoTarjeta));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {

                if (e != null) {toast("error desc escDatos " + context.getString(R.string.mostrarBotonPagoTarjeta));return;}
                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));

                    if (!escucharMsotrarBut_Tarjeta) {
                        escucharMsotrarBut_Tarjeta = true;
                        return;
                    }
                    unavezRecibidoNodo = false;
                    try {
                        if(object.getString(context.getString(R.string.mostrarBotonPagoTarjeta)).equals("1")){
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.mostrarBotonPagoTarjeta),  context.getString(R.string.mostrarBotonPagoTarjeta),"1");
                        }else {
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.mostrarBotonPagoTarjeta),  context.getString(R.string.mostrarBotonPagoTarjeta),"0");
                        }
                        setNodo_recibido(context.getString(R.string.mostrarBotonPagoTarjeta), object.getString(context.getString(R.string.mostrarBotonPagoTarjeta)));
                        intentet(context.getString(R.string.mostrarBotonPagoTarjeta), object);
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });

        documentRef = db().document("datos" + "/" + context.getString(R.string.mostrarBotonTransferencia));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {

                if (e != null) {toast("error desc escDatos " + context.getString(R.string.mostrarBotonTransferencia));return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));

                    if (!escucharMsotrarBut_Transferencia) {
                        escucharMsotrarBut_Transferencia = true;
                        return;
                    }
                    try {
                        unavezRecibidoNodo = false;
                        if(object.getString(context.getString(R.string.mostrarBotonTransferencia)).equals("1")){
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.mostrarBotonTransferencia),  context.getString(R.string.mostrarBotonTransferencia),"1");
                        }else {
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.mostrarBotonTransferencia),  context.getString(R.string.mostrarBotonTransferencia),"0");
                        }
                        setNodo_recibido(context.getString(R.string.mostrarBotonTransferencia), object.getString(context.getString(R.string.mostrarBotonTransferencia)));
                        intentet(context.getString(R.string.mostrarBotonTransferencia), object);
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });


        documentRef = db().document("datos" + "/" + context.getString(R.string.val_2x1_mostrar));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.val_2x1_mostrar));return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    if (!escucharMostrar3x2) {
                        escucharMostrar3x2 = true;
                        return;
                    }
                    try {
                        unavezRecibidoNodo = false;
                        if(object.getString(context.getString(R.string.val_2x1_mostrar)).equals("1")){
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.val_2x1_mostrar), context.getString(R.string.val_2x1_mostrar),"1");
                        }else {
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.val_2x1_mostrar), context.getString(R.string.val_2x1_mostrar),"0");
                        }
                        setNodo_recibido(context.getString(R.string.val_2x1_mostrar), object.getString(context.getString(R.string.val_2x1_mostrar)));
                        intentet(context.getString(R.string.val_2x1_mostrar), object);
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
        documentRef = db().document("datos" + "/" + context.getString(R.string.cobrar_comision));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos cobrar_comision");return;}
                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    if (!escucharCobrarComsion) {
                        escucharCobrarComsion = true;
                        return;
                    }
                    try {
                        unavezRecibidoNodo = false;
                        if(object.getString(context.getString(R.string.cobrar_comision)).equals("1")){
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.cobrar_comision), context.getString(R.string.cobrar_comision),"1");
                        }else {
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.cobrar_comision), context.getString(R.string.cobrar_comision),"0");
                        }
                        setNodo_recibido(context.getString(R.string.cobrar_comision), object.getString(context.getString(R.string.cobrar_comision)));
                        intentet(context.getString(R.string.cobrar_comision), object);
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
        documentRef = db().document("datos" + "/" + context.getString(R.string.dar_ticket));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos cobrar_comision");return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    if (!escucharDarTicket) {
                        escucharDarTicket = true;
                        return;
                    }
                    try {
                        unavezRecibidoNodo = false;
                        if(object.getString("dar_ticket").equals("1")){
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.dar_ticket),  context.getString(R.string.dar_ticket),"1");
                        }else {
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.dar_ticket),  context.getString(R.string.dar_ticket),"0");
                        }
                        setNodo_recibido(context.getString(R.string.dar_ticket), object.getString(context.getString(R.string.dar_ticket)));
                        intentet(context.getString(R.string.dar_ticket), object);
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
        documentRef = fire.db().document("datos" + "/" + context.getString(R.string.notificacion_update));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.notificacion_update));return;}
                if (!unaVezNotificacionAjustes) {
                    unaVezNotificacionAjustes = true;
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    notificacionAjustes.notificaciones(object, context);
                }else {
                    if (!loadData_sharedPreferences(context,  context.getString(R.string.notificacion_pase_de_lista), context.getString(R.string.notificacion_pase_de_lista)).equals("")){
                        removeData_sharedPreferences(context,context.getString(R.string.notificacion_pase_de_lista), context.getString(R.string.notificacion_pase_de_lista));
                    }
                }
            }
        });
        documentRef = db().document("datos" + "/" +  context.getString(R.string.statusFacial));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos facial");return;}
                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));

                    if (!escucharFacial) {
                        escucharFacial = true;
                        return;
                    }
                    try {
                        if(object.getString( context.getString(R.string.statusFacial)).equals("1")){
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.statusFacial),  context.getString(R.string.statusFacial),"1");
                        }else {
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.statusFacial),  context.getString(R.string.statusFacial),"0");
                        }
                        setNodo_recibido(context.getString(R.string.statusFacial), object.getString(context.getString(R.string.statusFacial)));
                        unavezRecibidoNodo = false;
                        intentet(context.getString(R.string.statusFacial), object);
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });

        documentRef = db().document("datos" + "/" + context.getString(R.string.limitarVenta_a_existencia));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.limitarVenta_a_existencia));return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));

                    if (!escucharLimitarExistencia) {
                        escucharLimitarExistencia = true;
                        return;
                    }
                    try {
                        unavezRecibidoNodo = false;
                        if(object.getString(context.getString(R.string.limitarVenta_a_existencia)).equals("1")){
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.limitarVenta_a_existencia), context.getString(R.string.limitarVenta_a_existencia),"1");
                        }else {
                            generales.saveData_sharedPreferences(context,  context.getString(R.string.limitarVenta_a_existencia), context.getString(R.string.limitarVenta_a_existencia),"0");
                        }
                        setNodo_recibido(context.getString(R.string.limitarVenta_a_existencia), object.getString(context.getString(R.string.limitarVenta_a_existencia)));
                        intentet(context.getString(R.string.limitarVenta_a_existencia), object);
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });

        documentRef = db().document("datos" + "/" + context.getString(R.string.equipoDeTrabajo));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.nombresCorte));return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    try {
                        jsonDatos.put(context.getString(R.string.equipoDeTrabajo), object);
                        actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
                        principal.enTurno_iniciar();

                        //setNodo_recibido(context.getString(R.string.nombresCorte),"1");
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
      /*


        documentRef = db().document("datos" + "/" + context.getString(R.string.passAdmin));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.passAdmin));return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    try {

                        if (!escucharPasAdmin) {
                            escucharPasAdmin = true;
                            return;
                        }
                        unavezRecibidoNodo = false;
                        JSONObject obj = new JSONObject();
                        obj.put(context.getString(R.string.passAdmin), object.getString(context.getString(R.string.passAdmin)));
                        jsonDatos.put(context.getString(R.string.passAdmin), obj);
                        generales.saveData_sharedPreferences(
                                context,
                                context.getString(R.string.passAdmin),
                                context.getString(R.string.passAdmin),
                                object.getString(context.getString(R.string.passAdmin)));

                        setNodo_recibido(context.getString(R.string.passAdmin),"1");

                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });

        documentRef = db().document("datos" + "/" + context.getString(R.string.tallas));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.tallas));return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    if (!escucharTallas) {
                        escucharTallas = true;
                        return;
                    }

                    try {
                        unavezRecibidoNodo = false;
                        JSONObject obj = new JSONObject();
                        obj.put(context.getString(R.string.tallas), object);
                        jsonDatos.put(context.getString(R.string.tallas), object);
                        setNodo_recibido(context.getString(R.string.tallas),"1");
                    } catch (JSONException ex) {
                        throw new RuntimeException(ex);
                    }

                }
            }
        });
       */
        documentRef = db().document("datos" + "/" + context.getString(R.string.articulos_ac));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (e != null) {toast("error desc escDatos " + context.getString(R.string.articulos_ac));return;}

                if (snapshot != null && snapshot.exists()) {
                    JSONObject object = new JSONObject(Objects.requireNonNull(snapshot.getData()));
                    if (getJsonGuardado("jsonArticulos") != null){
                        jsonArticulos = getJsonGuardado("jsonArticulos");
                        modulos_descarga.articulos articulos = new articulos(context);
                        articulos.escucharArticulosEnDatos(object, principal);
                    }else {
                        descargarArticulos(true);
                    }
                }else{
                    if (getJsonGuardado("jsonArticulos") != null){
                        jsonArticulos = getJsonGuardado("jsonArticulos");
                        toast("ART_LOCAL");
                    }else toast("necesario descargar articulos");
                }
            }
        });
        documentRef = db().document("datos" + "/" + context.getString(R.string.mensajes_ac));
        documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                if (!unavezMensaje) {
                    unavezMensaje = true;
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    modulos_descarga.mensajes modulo = new mensajes(context);
                    modulo.escucharMensajeEnDatos(new JSONObject(Objects.requireNonNull(snapshot.getData())));
                }
            }
        });

    }

    static boolean mensajeUnVezSolo_inicio     = true;
    static boolean unavezRecibidoNodo          = false;
    public static boolean unavezVenta = false;
    static public boolean unavezMensaje = true;

    private void escucharMensajeEnDatos(JSONObject object){

        // huella - > millis()
        try {
            String keyName = context.getString(R.string.huella_mensaje);
            String huellaLocal = loadData_sharedPreferences(context, keyName, keyName);
            String huellallegada = "";
            if(object.has(context.getString(R.string.huella_mensaje))){
                huellallegada = object.getString(context.getString(R.string.huella_mensaje));
            }
            generales.saveData_sharedPreferences(
                    context,
                    context.getString(R.string.huella_mensaje),
                    context.getString(R.string.huella_mensaje), huellallegada);

            String año = "20" + getAnñoMesDiaHora("año");
            String mes = getAnñoMesDiaHora("mes");
            String dia = getAnñoMesDiaHora("dia");

            jsonMensajes_n = getJsonGuardado("jsonMensajes_n");
            if(huellaLocal.equals("")){
                if(jsonMensajes_n == null){
                    getMensajeDiaEntero(año, mes, dia, true, "");
                }else {
                    // hay un problema
                    toast("PROBLEMA AL RECIBIR MENSAJE FUN ESC.MENJASE EN DATOS");
                }
            }else {
                if(!huellaLocal.equals(huellallegada)){
                    String fecha = formatearFechaDesdeID(huellaLocal);

                    String año_get = fecha.split("-")[0];
                    String mes_get = fecha.split("-")[1];
                    String dia_get = fecha.split("-")[2];
                    String hastaDonde = "";
                    if(año_get.equals(año)){
                        if(mes_get.equals(mes)){
                            if(dia_get.equals(dia)){

                            } else hastaDonde = "dia";
                        } else hastaDonde = "mes";
                    }else hastaDonde = "año";

                    if(hastaDonde.equals("")){
                        getMensajeDiaEntero(año, mes, dia, false, hastaDonde);
                    } else  {
                        descargar_fechasMensaje("mensajes_n", fecha, hastaDonde);
                    }
                } else toast("huellas iguales");
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    public void descargar_fechasMensaje(String direccion, String fechaComparacion, String hastaDonde){

        JSONObject json = new JSONObject();
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {

                if (documentSnapshots.isEmpty()) {
                    return;
                } else {
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    try {
                        objectFechasMensaje = new JSONObject(json.toString());
                        actualizarDatosGuardados("objectFechasMensaje", objectFechasMensaje.toString(), context);

                        LocalDate fechaInicio = parsearFecha(fechaComparacion);
                        // Obtener la fecha actual
                        LocalDate fechaActual = obtenerFechaActual();

                        // Generar las fechas faltantes
                        List<fecha> fechasFaltantes = generarFechasFaltantes(objectFechasMensaje, fechaInicio, fechaActual);

                        // Convertir las fechas faltantes a JSONObject
                        JSONObject jsonFaltantes = convertirFaltantesAJSONObject(fechasFaltantes);

                        if (fechasFaltantes.size() == 1) {
                            fecha unicaFechaFaltante = fechasFaltantes.get(0);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                if (unicaFechaFaltante.getAño() == fechaActual.getYear() &&
                                        unicaFechaFaltante.getMes() == fechaActual.getMonthValue() &&
                                        unicaFechaFaltante.getDia() == fechaActual.getDayOfMonth()) {
                                    // La única fecha faltante es la fecha actual, retornar JSONObject vacío
                                    jsonFaltantes = new JSONObject();  // JSONObject vacío
                                } else {
                                    // Hay otras fechas faltantes además de la fecha actual
                                    jsonFaltantes = convertirFaltantesAJSONObject(fechasFaltantes);
                                }
                            }
                        } else {
                            // Hay más de una fecha faltante, o ninguna
                            if (fechasFaltantes.isEmpty()) {
                                // No hay fechas faltantes, retornar JSONObject vacío
                                jsonFaltantes = new JSONObject();
                            } else {
                                // Hay múltiples fechas faltantes, convertir a JSONObject
                                jsonFaltantes = convertirFaltantesAJSONObject(fechasFaltantes);
                            }
                        }

                        if(jsonFaltantes.length() == 0){
                            String año = getAnñoMesDiaHora("año");
                            String mes = getAnñoMesDiaHora("mes");
                            String dia = getAnñoMesDiaHora("dia");
                            getMensajeDiaEntero(año, mes, dia, false, hastaDonde);
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        });
    }
    public void mesventa(){


        JSONObject json = new JSONObject();
        refCollection("ventas_n").get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {

                if (documentSnapshots.isEmpty()) {
                    return;
                } else {
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }

                    objectFechasVenta = json;
                    actualizarDatosGuardados("objectFechasVenta", objectFechasVenta.toString(), context);
           /*
                    JSONObject obj_mes = new JSONObject();
                    for (int i = 0; i < json.names().length(); i++){
                        try {
                            if(json.names().getString(i).split("_")[0].equals("2024")){

                                obj_mes.put(quitarCero(json.names().getString(i).split("_")[1]),
                                        json.getJSONObject(json.names().getString(i)));
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }

                    documenRef("ventas_n/" + "2024").
                            set(new Gson().fromJson(
                                    obj_mes.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                                @Override
                                public void onSuccess(Void unused) {

                                }
                            });
            */
                }
            }
        });
    }
    public static LocalDate parsearFecha(String fechaStr) {
        String[] partes = fechaStr.split("-");
        if (partes.length != 3) {
            throw new IllegalArgumentException("Formato de fecha inválido. Debe ser 'yyyy-M-d'.");
        }
        int año = Integer.parseInt(partes[0]);
        int mes = Integer.parseInt(partes[1]);
        int dia = Integer.parseInt(partes[2]);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return LocalDate.of(año, mes, dia);
        } else return null;
    }

    public static LocalDate obtenerFechaActual() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return LocalDate.now();
        } else return null;
    }

    public static List<fecha> generarFechasFaltantes(JSONObject datos, LocalDate fechaInicio, LocalDate fechaActual) throws JSONException {
        List<fecha> faltantes = new ArrayList<>();

        // Iterar desde la fecha de inicio hasta la fecha actual
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            for (LocalDate fecha = fechaInicio; !fecha.isAfter(fechaActual); fecha = fecha.plusDays(1)) {
                int año = fecha.getYear();
                int mes = fecha.getMonthValue();
                int dia = fecha.getDayOfMonth();

                // Verificar si el año existe en 'datos'
                if (datos.has(String.valueOf(año))) {
                    JSONObject meses = datos.getJSONObject(String.valueOf(año));

                    // Verificar si el mes existe
                    if (meses.has(String.valueOf(mes))) {
                        JSONObject dias = meses.getJSONObject(String.valueOf(mes));

                        // Verificar si el día existe
                        if (dias.has(String.valueOf(dia))) {
                            continue; // La fecha existe, omitir
                        }
                    }
                }

                // Si llegamos aquí, la fecha no existe en 'datos'
                faltantes.add(new fecha(año, mes, dia));
            }
        }

        return faltantes;
    }

    public static JSONObject convertirFaltantesAJSONObject(List<fecha> faltantes) throws JSONException {
        JSONObject jsonFaltantes = new JSONObject();
        JSONArray fechasArray = new JSONArray();

        for (fecha fecha : faltantes) {
            JSONObject fechaObj = new JSONObject();
            fechaObj.put("año", fecha.getAño());
            fechaObj.put("mes", fecha.getMes());
            fechaObj.put("dia", fecha.getDia());
            fechasArray.put(fechaObj);
        }

        jsonFaltantes.put("fechasFaltantes", fechasArray);
        return jsonFaltantes;
    }
    private void getMensajeDiaEntero(String año, String mes, String dia, boolean primeraVez_nuevoUsusario, String hastaDonde){
        fire.documenRef("mensajes_n/" + año + "/" + mes + "/" + dia).get().addOnCompleteListener(new OnCompleteListener<DocumentSnapshot>() {
            @Override
            public void onComplete(@NonNull Task<DocumentSnapshot> task) {
                if (task.isSuccessful()) {
                    DocumentSnapshot document = task.getResult();
                    if (document.exists()) {
                        try {
                            JSONObject object = mapToJSON(Objects.requireNonNull(document.getData()));

                            if(primeraVez_nuevoUsusario){
                                JSONObject obj_dia = new JSONObject();
                                obj_dia.put(dia, object);
                                JSONObject obj_mes = new JSONObject();
                                obj_mes.put(mes, obj_dia);
                                jsonMensajes_n.put(año, obj_mes);
                            }else {
                                if(!hastaDonde.equals("")) jsonMensajes_n.getJSONObject(año).getJSONObject(mes).getJSONObject(dia).put("mensajes", object.getJSONArray("mensajes"));
                                else {
                                    if(hastaDonde.equals("año")){
                                        JSONObject obj_dia = new JSONObject();
                                        obj_dia.put(dia, object);
                                        JSONObject obj_mes = new JSONObject();
                                        obj_mes.put(mes, obj_dia);
                                        jsonMensajes_n.put(año, obj_mes);
                                    } else if (hastaDonde.equals("mes")) {
                                        JSONObject obj_dia = new JSONObject();
                                        obj_dia.put(dia, object);
                                        jsonMensajes_n.getJSONObject(año).put(mes, obj_dia);
                                    } else if (hastaDonde.equals("dia")) {
                                        jsonMensajes_n.getJSONObject(año).getJSONObject(mes).put(dia, object);
                                    }else {
                                        jsonMensajes_n.getJSONObject(año).getJSONObject(mes).put(dia, object.getJSONArray("mensajes"));
                                    }
                                }
                            }
                            actualizarDatosGuardados("jsonMensajes_n", jsonMensajes_n.toString(), context);

                            Intent intent = new Intent("FIRESTORE_UPDATE_ACTION_mensajes_ac");
                            intent.putExtra("datos", "mensaje");  // 'data' es el dato actualizado de Firestore
                            intent.putExtra("extra_data",
                                    jsonMensajes_n.getJSONObject(año).getJSONObject(mes).getJSONArray(dia).
                                            getJSONObject( jsonMensajes_n.getJSONObject(año).getJSONObject(mes).getJSONArray(dia).length()-1).toString());  // 'data' es el dato actualizado de Firestore
                            LocalBroadcastManager.getInstance(context).sendBroadcast(intent);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    } else {

                    }
                } else {

                }
            }
        });
    }

    public static String formatearFechaDesdeID(String id) {
        // Verifica que la cadena tenga al menos 8 caracteres para la fecha
        if (id == null || id.length() < 8) {
            System.err.println("ID inválido: la cadena es nula o demasiado corta.");
            return null;
        }

        try {
            // Extrae las partes de la fecha
            String anioStr = id.substring(0, 4);
            String mesStr = id.substring(4, 6);
            String diaStr = id.substring(6, 8);

            // Convierte mes y día a enteros para eliminar ceros a la izquierda
            int anio = Integer.parseInt(anioStr);
            int mes = Integer.parseInt(mesStr);
            int dia = Integer.parseInt(diaStr);

            // Formatea la fecha
            return String.format("%d-%d-%d", anio, mes, dia);
        } catch (NumberFormatException | IndexOutOfBoundsException e) {
            System.err.println("Error al formatear la fecha desde el ID: " + e.getMessage());
            return null;
        }
    }

    static private String huellaArticulos = "";
    static int tamArticulos = 0;
    JSONObject provicional_DescArt = new JSONObject();

    public void descargarArticulos(boolean estado_primeravezActualizacion){
        String direccion = "articulos_n";
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {
                if (documentSnapshots.isEmpty()) {
                    if (decargarTodo){
                        toast("ARTICULOS NO EXISTE");
                    }
                    return;
                } else {
                    JSONObject json = new JSONObject();
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);
                            jsonArticulos = json;
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    initArticulos();
                    if(estado_primeravezActualizacion){

                    }
                }
            }
        });
    }

    private void initArticulos(){
        jsonSiglas = new JSONObject();
        for (int i = 0; i < jsonArticulos.names().length(); i++){
            try {
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("sigla")){
                    JSONObject object = new JSONObject();
                    object.put("id", jsonArticulos.names().getString(i));
                    jsonSiglas.put(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("sigla"), object);
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        actualizarDatosGuardados("jsonArticulos", jsonArticulos.toString(), context);
        principal.actualizarAutocomplete();
    }
    public void descargarDatos(){
        String direccion = "datos";
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {
                if (documentSnapshots.isEmpty()) {
                    return;
                } else {
                    JSONObject json = new JSONObject();
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    datosDescargadosNotificar();
                    jsonDatos = json;
                    actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
                    elementosDatos();
                }
            }
        }).addOnFailureListener(new OnFailureListener() {
            @Override
            public void onFailure(@NonNull Exception e) {
                principal.enTurnoSinConexion();
            }
        });
    }
    public void descargarDatosInit(){
        String direccion = "datos";
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {
                if (documentSnapshots.isEmpty()) {
                    principal.initUser();
                    return;
                } else {
                    JSONObject json = new JSONObject();
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    jsonDatos = json;
                    actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
                    principal.initUser();
                }
            }
        }).addOnFailureListener(new OnFailureListener() {
            @Override
            public void onFailure(@NonNull Exception e) {
                principal.enTurnoSinConexion();
            }
        });
    }
    private void datosDescargadosNotificar(){
        long tiempoActual = System.currentTimeMillis();
        String huella = Long.toString(tiempoActual, 36);
        JSONObject object = new JSONObject();
        try {
            String idDispositivo = generales.loadData_sharedPreferences(context, "id_mensaje", "dispositivo");
            object.put(idDispositivo, huella + " " + "nodo");
            fire.db().collection("datos").document("datos_desc").
                    set(new Gson().fromJson(object.toString(), HashMap.class));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void descargarDatos_Seccion_descargarTodo(){
        String direccion = "datos";
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {
                if (documentSnapshots.isEmpty()) {
                    if (decargarTodo){
                        toast("DOCUMENTO DATOS NO EXISTE");
                    }
                    return;
                } else {
                    JSONObject json = new JSONObject();
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    jsonDatos = json;
                    actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), context);
                    datosDescargadosNotificar();

                }
            }
        }).addOnFailureListener(new OnFailureListener() {
            @Override
            public void onFailure(@NonNull Exception e) {

            }
        });
    }

    private void getData_0_1(String url){
        if(jsonDatos.has(url)){
            try {
                generales.saveData_sharedPreferences(context, url, url,
                        jsonDatos.getJSONObject(url).getString(url));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else generales.saveData_sharedPreferences(context, url, url, "0");
    }

    private void elementosDatos(){

        if(jsonDatos.has(context.getString(R.string.equipoDeTrabajo)));//principal.enTurno_iniciar();

        getData_0_1(context.getString(R.string.val_2x1_mostrar));

        getData_0_1(context.getString(R.string.limitarVenta_a_existencia));

        getData_0_1(context.getString(R.string.statusFacial));

        getData_0_1(context.getString(R.string.cobrar_comision));

        getData_0_1(context.getString(R.string.datosTicket));

        getData_0_1(context.getString(R.string.mostrarBotonPagoTarjeta));

        getData_0_1(context.getString(R.string.mostrarBotonTransferencia));

        getData_0_1(context.getString(R.string.dar_ticket));


        if (!unaVezHiloEscuchar){
            unaVezHiloEscuchar = true;
            escucharDatos();
        }
    }
    public void descargarApartados(){
        String direccion = "apartados";
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {
                if (documentSnapshots.isEmpty()) {
                    if (decargarTodo){
                        toast("APARTADOS NO EXISTE");
                    }
                    return;
                } else {
                    JSONObject json = new JSONObject();
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    jsonPedido = json;
                    actualizarDatosGuardados("jsonPedido", jsonPedido.toString(), context);

                }
            }
        });
    }
    public void descargarClientes(){
        String direccion = "cliente";
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {
                if (documentSnapshots.isEmpty()) {
                    if (decargarTodo){
                        toast("CLIENTES NO EXISTE");
                    }
                    return;
                } else {
                    JSONObject json = new JSONObject();
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    jsonClientes = json;
                    actualizarDatosGuardados("jsonClientes", jsonClientes.toString(), context);

                }
            }
        });
    }
    public void descargarVentaArticulo(){
        String direccion = "ventaArticulo";
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {
                if (documentSnapshots.isEmpty()) {
                    if (decargarTodo){
                        toast("VENTA POR ARTICULO NO EXISTE");
                    }
                    return;
                } else {
                    JSONObject json = new JSONObject();
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    jsonVentaXarticulo = json;
                    actualizarDatosGuardados("jsonVentaXarticulo", jsonVentaXarticulo.toString(), context);

                }
            }
        });
    }
    public void descargar_solo_Fechas(String direccion){

        JSONObject json = new JSONObject();
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {

                if (documentSnapshots.isEmpty()) {
                    return;
                } else {
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    if(direccion.equals("mensajes_n")){
                        try {
                            objectFechasMensaje = new JSONObject(json.toString());
                            actualizarDatosGuardados("objectFechasMensaje", objectFechasMensaje.toString(), context);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    } else  if(direccion.equals("ventas_n")){
                        try {
                            objectFechasVenta = new JSONObject(json.toString());
                            actualizarDatosGuardados("objectFechasVenta", objectFechasVenta.toString(), context);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    } else if (direccion.equals("jsonCorteHistorial")) {
                        try {
                            objectFechasCorte = new JSONObject(json.toString());
                            actualizarDatosGuardados("objectFechasCorte", objectFechasCorte.toString(), context);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                }
            }
        });
    }
    public void descargarJSON_Venta_MensajesTodo(String direccion){

        JSONObject json = new JSONObject();
        final JSONObject descJSON_porFechasCompleto = new JSONObject();
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {

                if (documentSnapshots.isEmpty()) {


                    return;
                } else {
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    if(direccion.equals("mensajes_n")){
                        try {
                            objectFechasMensaje = new JSONObject(json.toString());
                            actualizarDatosGuardados("objectFechasMensaje", objectFechasMensaje.toString(), context);
                            getVentaMensajesCompletos(json, direccion, descJSON_porFechasCompleto);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }else  if(direccion.equals("ventas_n")){
                        try {
                            objectFechasVenta = new JSONObject(json.toString());
                            actualizarDatosGuardados("objectFechasVenta", objectFechasVenta.toString(), context);
                            getVentaMensajesCompletos(json, direccion, descJSON_porFechasCompleto);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }

                }
            }
        });
    }

    JSONObject objectMensajesAc = new JSONObject();
    public void descargarJSON_hechoporfechas(String direccion){

        JSONObject json = new JSONObject();
        final JSONObject descJSON_porFechasCompleto = new JSONObject();
        refCollection(direccion).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
            @Override
            public void onSuccess(QuerySnapshot documentSnapshots) {

                if (documentSnapshots.isEmpty()) {
                    return;
                } else {
                    for (DocumentSnapshot document : documentSnapshots) {
                        try {
                            JSONObject obj = mapToJSON(document.getData());
                            json.put(document.getId(), obj);

                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                    if(direccion.equals("mensajes_n")){
                        try {
                            objectFechasMensaje = new JSONObject(json.toString());
                            actualizarDatosGuardados("jsonMensajes_n_Fechas", objectFechasMensaje.toString(), context);
                            if(getJsonGuardado("jsonMensajes_n") != null){
                                jsonMensajes_n = getJsonGuardado("jsonMensajes_n");
                                if(mensajeUnVezSolo_inicio){
                                    mensajeUnVezSolo_inicio = false;
                                    if(objectMensajesAc.length() > 0) escucharMensajeEnDatos(objectMensajesAc);
                                }
                            }else {
                                getVentaMensajesCompletos(json, direccion, descJSON_porFechasCompleto);
                            }

                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }else  if(direccion.equals("ventas_n")){
                        try {
                            objectFechasVenta = new JSONObject(json.toString());
                            actualizarDatosGuardados("objectFechasVenta", objectFechasVenta.toString(), context);
                            if(getJsonGuardado("jsonVenta") != null){
                                jsonVenta = getJsonGuardado("jsonVenta");
                            }else {
                                getVentaMensajesCompletos(json, direccion, descJSON_porFechasCompleto);
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                }
            }
        });
    }

    private void getVentaMensajesCompletos(JSONObject json, String direccion, JSONObject descJSON_porFechasCompleto){
        for (int i = 0; i < json.names().length(); i++){
            try {
                String añoString = json.names().getString(i);
                JSONObject mes = json.getJSONObject(añoString);
                JSONObject mesPrincipal = new JSONObject();
                for (int x = 0; x < mes.names().length(); x++){


                    String mesString = mes.names().getString(x);

                    String url = direccion + "/" + añoString + "/" + mesString;

                    refCollection(url).get().addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
                        @Override
                        public void onSuccess(QuerySnapshot documentSnapshots) {
                            if (documentSnapshots.isEmpty()) {
                                return;
                            } else {
                                JSONObject diasJSON = new JSONObject();
                                for (DocumentSnapshot document : documentSnapshots) {
                                    try {
                                        JSONObject obj = mapToJSON(document.getData());
                                        if(direccion.equals("ventas_n")){
                                            diasJSON.put(document.getId(), obj.getJSONArray("registro"));
                                        }else if (direccion.equals("mensajes_n")){
                                            diasJSON.put(document.getId(), obj.getJSONArray("mensajes"));
                                        }
                                    } catch (JSONException e) {
                                        e.printStackTrace();
                                    }
                                }
                                try {
                                    mesPrincipal.put(mesString, diasJSON);
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            }
                        }
                    }).addOnSuccessListener(new OnSuccessListener<QuerySnapshot>() {
                        @Override
                        public void onSuccess(QuerySnapshot queryDocumentSnapshots) {
                            try {
                                if (mesPrincipal.names().length() == mes.names().length()){
                                    descJSON_porFechasCompleto.put(añoString, mesPrincipal);
                                }
                                if (descJSON_porFechasCompleto.length() > 0){
                                    if (descJSON_porFechasCompleto.names().length() == json.names().length()){

                                        JSONObject jsnVentaRespaldo = new JSONObject(descJSON_porFechasCompleto.toString());
                                        ArrayList<Integer> ordenarAño = new ArrayList<Integer>();
                                        for (int u = 0; u < jsnVentaRespaldo.names().length(); u++){
                                            ordenarAño.add(Integer.parseInt(jsnVentaRespaldo.names().getString(u)));
                                        }
                                        Collections.sort(ordenarAño);

                                        for (int u = 0; u < jsnVentaRespaldo.names().length(); u++){
                                            String año = String.valueOf(ordenarAño.get(u));
                                            JSONObject mes_jsn = jsnVentaRespaldo.getJSONObject(año);

                                            ArrayList<Integer> ordenarMes = new ArrayList<Integer>();
                                            for (int x = 0; x < mes_jsn.names().length(); x++){
                                                ordenarMes.add(Integer.parseInt(mes_jsn.names().getString(x)));
                                            }
                                            Collections.sort(ordenarMes);

                                            JSONObject mesRespJsn = new JSONObject();

                                            for (int p = 0; p < mes_jsn.names().length(); p++){
                                                String mes = String.valueOf(ordenarMes.get(p));
                                                JSONObject diaobj = mes_jsn.getJSONObject(mes);

                                                JSONObject objectDia = new JSONObject();
                                                if(direccion.equals("ventas_n")){
                                                    for (int y = 0; y < diaobj.names().length(); y++){//numeroDeVenta

                                                        JSONObject objVenta = new JSONObject();

                                                        objVenta.put("registro", jsnVentaRespaldo.
                                                                getJSONObject(año).
                                                                getJSONObject(mes).
                                                                getJSONArray(diaobj.names().getString(y)));
                                                        objectDia.put(diaobj.names().getString(y), objVenta);
                                                    }
                                                    mesRespJsn.put(mes, objectDia);
                                                }else if (direccion.equals("mensajes_n")){
                                                    for (int y = 0; y < diaobj.names().length(); y++){
                                                        objectDia.put(
                                                                diaobj.names().getString(y),
                                                                jsnVentaRespaldo.
                                                                        getJSONObject(año).
                                                                        getJSONObject(mes).
                                                                        getJSONArray(diaobj.names().getString(y)));
                                                    }
                                                    mesRespJsn.put(mes, objectDia);
                                                }
                                            }
                                            descJSON_porFechasCompleto.put(año, mesRespJsn);
                                        }
                                        DocumentReference documentRef;
                                        switch (direccion){
                                            case "ventas_n":
                                                jsonVenta = new JSONObject(descJSON_porFechasCompleto.toString());
                                                actualizarDatosGuardados("jsonVenta", jsonVenta.toString(), context);
                                                if(decargarTodo){
                                                    if (!descargaTodo_venta){
                                                        unavezVenta = false;
                                                        descargaTodo_venta = true;
                                                    }
                                                    documentRef = db().document("datos" + "/" + "ventas_ac");
                                                    documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
                                                        @Override
                                                        public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                                                            if (e != null) {toast("error desc escDatos tallas");return;}
                                                            if (!unavezVenta) {
                                                                unavezVenta = true;
                                                                return;
                                                            }
                                                            if (snapshot != null && snapshot.exists()) {
                                                                if (getJsonGuardado("jsonVenta") != null){
                                                                    jsonVenta = getJsonGuardado("jsonVenta");
                                                                    //escucharVentaEnDatos(new JSONObject(Objects.requireNonNull(snapshot.getData())));
                                                                }else{
                                                                    descargarJSON_hechoporfechas("ventas_n");
                                                                }
                                                            }else{
                                                                descargarJSON_hechoporfechas("ventas_n");
                                                            }
                                                        }
                                                    });
                                                }

                                                break;
                                            case "mensajes_n":
                                                jsonMensajes_n = new JSONObject(descJSON_porFechasCompleto.toString());
                                                actualizarDatosGuardados("jsonMensajes_n", jsonMensajes_n.toString(), context);

                                                if(decargarTodo){
                                                    if (!descargaTodo_mensaje){
                                                        unavezMensaje = false;
                                                        descargaTodo_mensaje = true;
                                                    }
                                                    documentRef = db().document("datos" + "/" + "mensajes_ac");
                                                    documentRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
                                                        @Override
                                                        public void onEvent(@Nullable DocumentSnapshot snapshot, @Nullable FirebaseFirestoreException e) {
                                                            if (!unavezMensaje) {
                                                                unavezMensaje = true;
                                                                return;
                                                            }
                                                            if (snapshot != null && snapshot.exists()) {
                                                                if (getJsonGuardado("jsonMensajes_n") != null){
                                                                    descargar_solo_Fechas("mensajes_n");
                                                                    escucharMensajeEnDatos(new JSONObject(Objects.requireNonNull(snapshot.getData())));
                                                                }else {
                                                                    descargarJSON_hechoporfechas("mensajes_n");
                                                                }
                                                            }else{
                                                                descargarJSON_hechoporfechas("mensajes_n");
                                                            }
                                                        }
                                                    });
                                                }
                                                break;
                                        }

                                    }
                                }

                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }

                        }
                    });
                }

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }

    public static boolean descargaTodo_mensaje = false;
    public static boolean descargaTodo_venta = false;

    public static JSONObject mapToJSON(Map<String, Object> map) throws JSONException {
        JSONObject obj_ = new JSONObject();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (value instanceof Map) {
                Map<String, Object> subMap = (Map<String, Object>) value;
                obj_.put(key, mapToJSON(subMap));
            } else if (value instanceof List) {
                obj_.put(key, listToJSONArray((List) value));
            }
            else {
                obj_.put(key, value);
            }
        }
        return obj_;
    }
    private static JSONArray listToJSONArray(List<Object> list) throws JSONException {
        JSONArray arr = new JSONArray();

        for(Object obj: list) {
            if (obj instanceof Map) {
                arr.put(mapToJSON((Map) obj));
            }
            else if(obj instanceof List) {
                arr.put(listToJSONArray((List) obj));
            }
            else {
                arr.put(obj);
            }
        }
        return arr;
    }
    private JSONObject getJsonGuardado(String name){
        File file = new File(context.getFilesDir(),name);
        FileReader fileReader = null;
        try {
            fileReader = new FileReader(file);
            BufferedReader bufferedReader = new BufferedReader(fileReader);
            StringBuilder stringBuilder = new StringBuilder();
            String line = bufferedReader.readLine();
            while (line != null){
                stringBuilder.append(line).append("\n");
                line = bufferedReader.readLine();
            }
            bufferedReader.close();
            String responce = stringBuilder.toString();

            return new JSONObject(responce);
        } catch (IOException | JSONException e) {
            e.printStackTrace();
            return null;
        }
    }
    public CollectionReference refCollection(String refCollection){
        CollectionReference reference = db().collection(refCollection);
        return reference;
    }
    private void toast(String s){
        generales.toast(s, context);
    }
}
