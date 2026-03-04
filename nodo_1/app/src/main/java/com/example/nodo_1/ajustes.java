package com.example.nodo_1;

import static com.example.nodo_1.admin.browseBluetoothDevice;
import static com.example.nodo_1.fire.documenRef;
import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.saveData_sharedPreferences;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonDatos;

import static pagoTarjeta.uno.selectedDevice_static;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.PopupWindow;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Objects;

import descarga_init.descarga;
import internet.NetworkMonitor;
import pase_de_lista.notificarCambioAjustesA_PaseDeLista;
import pop.dspositivos_status_recibido_update;
import pop.popAgergarNomCorte;
import pop.pop_informacionDeposito;
import propiedades_articulos.generarDescuento;
import propiedades_articulos.tallas;

public class ajustes extends AppCompatActivity implements View.OnClickListener,  NetworkMonitor.NetworkChangeListener{

    private NetworkMonitor networkMonitor;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.ajustes);
        generales.initPantalla_barra_azulDatoSegmento_texto_blanco(getWindow(), getApplicationContext());
        networkMonitor = new NetworkMonitor(this, this);
        datosGuardados();

        JSONObject object;
        String objectString = loadData_sharedPreferences(
                getApplicationContext(),
                getApplicationContext().getString(R.string.notificacion_pase_de_lista),
                getApplicationContext().getString(R.string.notificacion_pase_de_lista));
        if (!objectString.equals("")){
            try {
                object = new JSONObject(objectString);
                setColor(object);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }
    private static final int REQUEST_BLUETOOTH_PERMISSIONS = 1;

    pop.dspositivos_status_recibido_update recibido_update;
    public void actualizar_fun_en_clase(){
        recibido_update.actualozar_pop();
    }
    PopupWindow popupWindow = null;
    public void getPopWindow(PopupWindow popupWindow){this.popupWindow = popupWindow;}
    @Override
    public void onClick(View view) {
        try {
            if(R.id.but_status_uptade_ajustes == view.getId()){
                recibido_update = new dspositivos_status_recibido_update();
                recibido_update.showPopupWindow(view, this);
            } else if (R.id.button37 == view.getId()) {
                // Comprueba si el permiso ya está otorgado
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                        != PackageManager.PERMISSION_GRANTED) {
                    // Solicita el permiso al usuario
                    ActivityCompat.requestPermissions(this,
                            new String[]{Manifest.permission.BLUETOOTH_CONNECT},
                            REQUEST_BLUETOOTH_PERMISSIONS);
                }
                browseBluetoothDevice();
            } else if(R.id.but_nomCorte == view.getId()){
               /*
                popAgergarNomCorte popAgergarNomCorte = new popAgergarNomCorte();
                popAgergarNomCorte.showPopupWindow(view, this);
                */
            } else if (R.id.but_contraseña_admin == view.getId()) {
               /*
                pop.pop_pasword pop_pasword = new pop.pop_pasword();
                pop_pasword.showPopupWindow(view, this);
                */
            } else if (R.id.but_descuento == view.getId()){
                Intent askIntent = new Intent(this, generarDescuento.class);
                someActivityResultLauncher.launch(askIntent);
            } else if (R.id.butPop_tallas == view.getId()) {
                Intent askIntent = new Intent(this, tallas.class);
                someActivityResultLauncher.launch(askIntent);
            }  else if (R.id.butEditar_ticket == view.getId()) {
                Intent askIntent = new Intent(this, editarTicket.class);
                someActivityResultLauncher.launch(askIntent);
            } else if (R.id.but_informacionTransferencia == view.getId()) {
               /*
                pop_informacionDeposito pop_informacionDeposito = new pop_informacionDeposito();
                pop_informacionDeposito.showPopupWindow(view, this);
                */
            } else if (R.id.switch_LimitarVenta_a_existencia == view.getId()) {
                if(conexxionEstado){
                    /** switch_LimitarVenta_a_existencia **/
                    if(((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).isChecked()){
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.limitarVenta_a_existencia), getString(R.string.limitarVenta_a_existencia), "1");
                        subirDatos(getString(R.string.limitarVenta_a_existencia), "1", getString(R.string.limitarVenta_a_existencia));
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.limitarVenta_a_existencia), getString(R.string.limitarVenta_a_existencia),"0");
                        subirDatos(getString(R.string.limitarVenta_a_existencia), "0", getString(R.string.limitarVenta_a_existencia));
                    }
                    notificarCambioAjustesA_PaseDeLista.actualizar(getString(R.string.limitarVenta_a_existencia), statusSwitch(((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia))),getApplicationContext());
                }else toast("NO HAY CONEXIÓN A INTERNET", getApplicationContext());
            } else if (R.id.switchMostrar3x2EnLaVenta == view.getId()) {
                if(conexxionEstado){
                    /** 3X2 EN LA VENTA**/
                    if(((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).isChecked()){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.val_2X1_mostrar), getString(R.string.val_2X1_mostrar),"1");
                        subirDatos(getString(R.string.val_2X1_mostrar), "1", getString(R.string.val_2X1_mostrar));
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.val_2X1_mostrar), getString(R.string.val_2X1_mostrar),"0");
                        subirDatos(getString(R.string.val_2X1_mostrar), "0", getString(R.string.val_2X1_mostrar));
                    }
                    notificarCambioAjustesA_PaseDeLista.actualizar(getString(R.string.val_2X1_mostrar), statusSwitch(((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta))),getApplicationContext());
                }else toast("NO HAY CONEXIÓN A INTERNET", getApplicationContext());
            } else if(R.id.switch_ReconocimientoFacial == view.getId()){
                if(conexxionEstado){
                    /**RECONOCIMIENTO FACIAL**/
                    if(((Switch)findViewById(R.id.switch_ReconocimientoFacial)).isChecked()){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.statusFacial), getString(R.string.statusFacial),"1");
                        subirDatos(getString(R.string.statusFacial), "1", getString(R.string.statusFacial));
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.statusFacial), getString(R.string.statusFacial),"0");
                        subirDatos(getString(R.string.statusFacial), "0", getString(R.string.statusFacial));
                    }
                    notificarCambioAjustesA_PaseDeLista.actualizar(getString(R.string.statusFacial), statusSwitch(((Switch)findViewById(R.id.switch_ReconocimientoFacial))),getApplicationContext());
                }else toast("NO HAY CONEXIÓN A INTERNET", getApplicationContext());
            } else if (R.id.switch_Cobrarcomision == view.getId()) {
                if(conexxionEstado){
                    /**COBRAR COMISION**/
                    if(((Switch)findViewById(R.id.switch_Cobrarcomision)).isChecked()){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.cobrar_comision), getString(R.string.cobrar_comision),"1");
                        subirDatos(getString(R.string.cobrar_comision), "1", getString(R.string.cobrar_comision));
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.cobrar_comision), getString(R.string.cobrar_comision),"0");
                        subirDatos(getString(R.string.cobrar_comision), "0", getString(R.string.cobrar_comision));
                    }
                    notificarCambioAjustesA_PaseDeLista.actualizar(getString(R.string.cobrar_comision), statusSwitch(((Switch)findViewById(R.id.switch_Cobrarcomision))),getApplicationContext());
                }else toast("NO HAY CONEXIÓN A INTERNET", getApplicationContext());
            } else if (R.id.switch_Dar_ticket == view.getId()) {
                if(conexxionEstado){
                    /**DAR TICKET**/
                    if(((Switch)findViewById(R.id.switch_Dar_ticket)).isChecked()){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string. dar_ticket),  getString(R.string.dar_ticket),"1");
                        subirDatos( getString(R.string.dar_ticket), "1",  getString(R.string.dar_ticket));
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.dar_ticket),  getString(R.string.dar_ticket),"0");
                        subirDatos( getString(R.string.dar_ticket), "0",  getString(R.string.dar_ticket));
                    }
                    notificarCambioAjustesA_PaseDeLista.actualizar(getString(R.string.dar_ticket), statusSwitch(((Switch)findViewById(R.id.switch_Dar_ticket))),getApplicationContext());
                }else toast("NO HAY CONEXIÓN A INTERNET", getApplicationContext());
            } else if (R.id.switchMostrarBotonTransferencia == view.getId()) {
                if(conexxionEstado){
                    /**MOSTRAR BOTON TRANSFERENCIA**/
                    if(((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).isChecked()){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonTransferencia),  getString(R.string.mostrarBotonTransferencia),"1");
                        subirDatos( getString(R.string.mostrarBotonTransferencia), "1",  getString(R.string.mostrarBotonTransferencia));
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonTransferencia),  getString(R.string.mostrarBotonTransferencia),"0");
                        subirDatos( getString(R.string.mostrarBotonTransferencia), "0",  getString(R.string.mostrarBotonTransferencia));
                    }
                    notificarCambioAjustesA_PaseDeLista.actualizar(getString(R.string.mostrarBotonTransferencia), statusSwitch(((Switch)findViewById(R.id.switchMostrarBotonTransferencia))),getApplicationContext());
                }else toast("NO HAY CONEXIÓN A INTERNET", getApplicationContext());
            } else if (R.id.switchMostraBotonPagosConTarjeta == view.getId()) {
                if(conexxionEstado){
                    /**MOSTRAR BOTON TARJETA**/
                    if(((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).isChecked()){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonPagoTarjeta), getString(R.string.mostrarBotonPagoTarjeta),"1");
                        subirDatos(getString(R.string.mostrarBotonPagoTarjeta), "1", getString(R.string.mostrarBotonPagoTarjeta));
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonPagoTarjeta), getString(R.string.mostrarBotonPagoTarjeta),"0");
                        subirDatos(getString(R.string.mostrarBotonPagoTarjeta), "0", getString(R.string.mostrarBotonPagoTarjeta));
                    }

                    notificarCambioAjustesA_PaseDeLista.actualizar(getString(R.string.mostrarBotonPagoTarjeta), statusSwitch(((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta))),getApplicationContext());
                }else toast("NO HAY CONEXIÓN A INTERNET", getApplicationContext());
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    private String statusSwitch(Object object){
        if(((Switch)object).isChecked())return "1";
        else return "0";
    }

    public void subirDatos(String objKey, String objValue, String idDocument){
        JSONObject object = new JSONObject();
        try {
            object.put(objKey, objValue);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        documenRef("datos/" + idDocument).
                set(new Gson().fromJson(object.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                    @Override
                    public void onSuccess(Void unused) {
                        colorEstado("",objKey, "0");
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_1), getString(R.string.led_ajuestes_1), "0");
                        if (objKey.equals(getString(R.string.dar_ticket))) {
                            descarga.escucharDarTicket = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_1), getString(R.string.led_ajuestes_1), "0");
                        } else if(objKey.equals(getString(R.string.ticket_1))){
                            //descarga.tick = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_2), getString(R.string.led_ajuestes_2), "0");
                        } else if (objKey.equals(getString(R.string.passAdmin))) {
                            descarga.escucharPasAdmin = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_3), getString(R.string.led_ajuestes_3), "0");
                        } else if (objKey.equals(getString(R.string.statusFacial))) {
                            descarga.escucharFacial = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_4), getString(R.string.led_ajuestes_4), "0");
                        } else if (objKey.equals(getString(R.string.limitarVenta_a_existencia))) {
                            descarga.escucharLimitarExistencia= false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_5), getString(R.string.led_ajuestes_5), "0");
                        }   else if (objKey.equals(getString(R.string.mostrarBotonPagoTarjeta))) {
                            descarga.escucharMsotrarBut_Tarjeta = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_6), getString(R.string.led_ajuestes_6), "0");
                        } else if (objKey.equals(getString(R.string.cobrar_comision))) {
                            descarga.escucharCobrarComsion = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_7), getString(R.string.led_ajuestes_7), "0");
                        } else if (objKey.equals(getString(R.string.cambiar_comision))) {
                            //descarga.escucharMsotrarBut_Transferencia = false;
                            //saveData_sharedPreferences(getApplicationContext(), ;
                        } else if (objKey.equals(getString(R.string.mostrarBotonTransferencia))) {
                            descarga.escucharMsotrarBut_Transferencia = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_9), getString(R.string.led_ajuestes_9), "0");
                        } else if (objKey.equals(getString(R.string.transferencia_datos))) {
                            descarga.escucharDatosTransferencia = false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_10), getString(R.string.led_ajuestes_10), "0");
                        } else if (objKey.equals(getString(R.string.val_2X1_mostrar))) {
                            descarga.escucharMostrar3x2= false;
                            saveData_sharedPreferences(getApplicationContext(), getString(R.string.led_ajuestes_11), getString(R.string.led_ajuestes_11), "0");
                        }
                    }
                });
    }
    private void setColor(JSONObject object){
        if(object.length() > 0){
            try {
                JSONObject objNodosNames = new JSONObject();
                for (int i = 0; i < jsonDatos.getJSONObject("dispositivos_mensaje").names().length(); i++){
                    JSONObject obj = jsonDatos.getJSONObject("dispositivos_mensaje").getJSONObject(jsonDatos.getJSONObject("dispositivos_mensaje").names().getString(i));
                    if (obj.has("nodo")){
                        objNodosNames.put(jsonDatos.getJSONObject("dispositivos_mensaje").names().getString(i), "");
                    }
                }
                object.remove("huella");
                for (int i = 0; i < object.names().length(); i++){
                    JSONArray array = object.getJSONArray(object.names().getString(i));
                    for (int y = 0; y < array.length(); y++){
                        if(objNodosNames.has(array.getJSONObject(y).names().getString(0))){
                            if(array.getJSONObject(y).getBoolean(array.getJSONObject(y).names().getString(0))){
                                colorEstado("", object.names().getString(i), "1");
                            }else {
                                colorEstado("", object.names().getString(i), "0");
                            }
                        }
                    }
                }
                datosGuardados();
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }
    private BroadcastReceiver updateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent.hasExtra("nodo")){
                try {
                    setColor(new JSONObject(Objects.requireNonNull(intent.getStringExtra("nodo"))));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }else if(intent.hasExtra("data")){
                if(popupWindow!=null){
                    if(popupWindow.isShowing())actualizar_fun_en_clase();
                }
            }
        }
    };
    private void colorEstado(String todos, String objKey, String prviene){
        Drawable drawable = null;
        if(prviene.equals("0")){
            drawable = getDrawable(R.drawable.bola_estado_naranja);
        }else if(prviene.equals("1")){
            drawable = getDrawable(R.drawable.bola_estado_verde);
        }
        if(todos.equals("")){
            if(objKey.equals(getString(R.string.ticket_1))){
                ((TextView)findViewById(R.id.led_ajustes_2)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.mostrarBotonPagoTarjeta))) {
                ((TextView)findViewById(R.id.led_ajustes_6)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.mostrarBotonTransferencia))) {
                ((TextView)findViewById(R.id.led_ajustes_9)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.val_2X1_mostrar))) {
                ((TextView)findViewById(R.id.led_ajustes_11)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.dar_ticket))) {
                ((TextView)findViewById(R.id.led_ajustes_1)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.cobrar_comision))) {
                ((TextView)findViewById(R.id.led_ajustes_7)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.statusFacial))) {
                ((TextView)findViewById(R.id.led_ajustes_4)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.limitarVenta_a_existencia))) {
                ((TextView)findViewById(R.id.led_ajustes_5)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.passAdmin))) {
                ((TextView)findViewById(R.id.led_ajustes_3)).setBackground(drawable);
            } else if (objKey.equals(getString(R.string.transferencia_datos))) {
                ((TextView)findViewById(R.id.led_ajustes_10)).setBackground(drawable);
            }
        }else {
            ((TextView)findViewById(R.id.led_ajustes_1)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_2)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_3)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_4)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_5)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_6)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_7)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_8)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_9)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_10)).setBackground(drawable);
            ((TextView)findViewById(R.id.led_ajustes_11)).setBackground(drawable);
        }
    }

    public void  datosGuardados(){

        /** 2X1 EN LA VENTA**/
        if(!loadData_sharedPreferences(getApplicationContext(), getString(R.string.val_2X1_mostrar), getString(R.string.val_2X1_mostrar)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.val_2X1_mostrar), getString(R.string.val_2X1_mostrar)).equals("1")){
                ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(true);
            }else ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.val_2X1_mostrar), getString(R.string.val_2X1_mostrar)).equals("0")){
                ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(false);
            }else ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(true);
        }

        /**RECONOCIMIENTO FACIAL**/
        if(!loadData_sharedPreferences(getApplicationContext(), getString(R.string.statusFacial), getString(R.string.statusFacial)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.statusFacial), getString(R.string.statusFacial)).equals("1")){
                ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.statusFacial), getString(R.string.statusFacial)).equals("0")){
                ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(true);
        }

        /**COBRAR COMISION**/
        if(!loadData_sharedPreferences(getApplicationContext(), getString(R.string.cobrar_comision), getString(R.string.cobrar_comision)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.cobrar_comision), getString(R.string.cobrar_comision)).equals("1")){
                ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.cobrar_comision), getString(R.string.cobrar_comision)).equals("0")){
                ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(true);
        }

        /**LIMITAR VENTA A EXISTENCIA**/
        if(!loadData_sharedPreferences(getApplicationContext(), getString(R.string.limitarVenta_a_existencia), getString(R.string.limitarVenta_a_existencia)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.limitarVenta_a_existencia), getString(R.string.limitarVenta_a_existencia)).equals("1")){
                ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.limitarVenta_a_existencia), getString(R.string.limitarVenta_a_existencia)).equals("0")){
                ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(true);
        }

        /**DAR TICKET**/
        if(!loadData_sharedPreferences(getApplicationContext(),  getString(R.string.dar_ticket), getString(R.string.dar_ticket)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(),  getString(R.string.dar_ticket), getString(R.string.dar_ticket)).equals("1")){
                ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(),  getString(R.string.dar_ticket), getString(R.string.dar_ticket)).equals("0")){
                ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(true);
        }

        /**mostrarBotonPagoTarjeta**/
        if(!loadData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonPagoTarjeta), getString(R.string.mostrarBotonPagoTarjeta)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonPagoTarjeta), getString(R.string.mostrarBotonPagoTarjeta)).equals("1")){
                ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(true);
            }else ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonPagoTarjeta), getString(R.string.mostrarBotonPagoTarjeta)).equals("0")){
                ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(false);
            }else ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(true);
        }

        /**mostrarBotonTransferencia**/
        if(!loadData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonTransferencia), getString(R.string.mostrarBotonTransferencia)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonTransferencia), getString(R.string.mostrarBotonTransferencia)).equals("1")){
                ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(true);
            }else ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonTransferencia), getString(R.string.mostrarBotonTransferencia)).equals("0")){
                ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(false);
            }else ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(true);
        }
    }
    ActivityResultLauncher<Intent> someActivityResultLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            new ActivityResultCallback<ActivityResult>() {
                @Override
                public void onActivityResult(ActivityResult result) {
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        // There are no request codes
                        Intent data = result.getData();

                        if(data != null){

                        }else toast("EQUIPO NO REGISTRADO, ERROR", getApplicationContext());
                    }
                }
            });
    @Override
    protected void onStart() {
        super.onStart();
        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_2x1_notificacion");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_cobrar_comision_notificacion");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_facial_notificacion");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_limitarVenta_a_existencia_notificacion");
        //intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mensajes_ac");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_dar_ticket_notificacion");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mostrarBotonTransferencia_notificacion");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mostrarBotonPagoTarjeta_notificacion");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_nodo_notificacion");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_notificar_de_reibido");
        //intentFilter.addAction("FIRESTORE_UPDATE_ACTION_nodo");
        // intentFilter.addAction("FIRESTORE_UPDATE_ACTION_transferencia_datos");
        LocalBroadcastManager.getInstance(this).registerReceiver(updateReceiver, intentFilter);
    }

    @Override
    protected void onStop() {
        super.onStop();
        LocalBroadcastManager.getInstance(this).unregisterReceiver(updateReceiver);
    }


    static boolean conexxionEstado = false;
    static boolean primeraVezCoenxion = false;
    @Override
    public void onNetworkAvailable() {
        runOnUiThread(() -> {
            //CustomToast.showToast(this, "Conectado", Toast.LENGTH_LONG, String.valueOf(getColor(R.color.colortransparente)));
            conexxionEstado = true;
        });
    }

    @Override
    public void onNetworkLost() {
        runOnUiThread(() -> {
            //CustomToast.showToast(this, "Sin conexión", Toast.LENGTH_LONG,  String.valueOf(getColor(R.color.colortransparente)));
            conexxionEstado = false;
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        networkMonitor.unregisterNetworkCallback();
    }

    public void guardarDatosTransferencia(JSONObject object){
        saveData_sharedPreferences(
                getApplicationContext(),
                getString(R.string.transferencia_datos),
                getString(R.string.transferencia_datos),
                object.toString());

        subirDatos(
                getString(R.string.transferencia_datos),
                object.toString(),
                getString(R.string.transferencia_datos));
    }
    JSONArray arrayID_nodos;
    public JSONObject paseDeListaNodo(){
        JSONObject object = new JSONObject();
        String objectString = loadData_sharedPreferences(
                getApplicationContext(),
                getApplicationContext().getString(R.string.notificacion_pase_de_lista),
                getApplicationContext().getString(R.string.notificacion_pase_de_lista));
        arrayID_nodos = new JSONArray();
        try {
            if(!objectString.equals("")){
                object = new JSONObject(objectString);
            }else object.put("init", "");

            for (int i = 0; i < jsonDatos.getJSONObject("dispositivos_mensaje").names().length(); i++){
                JSONObject obj = jsonDatos.getJSONObject("dispositivos_mensaje").getJSONObject(jsonDatos.getJSONObject("dispositivos_mensaje").names().getString(i));
                if (obj.has("nodo")){
                    arrayID_nodos.put(jsonDatos.getJSONObject("dispositivos_mensaje").names().getString(i));
                }
            }
            return object;
        } catch (JSONException e) {
            return null;
        }
    }
    private void noSeA_Azcualizado_0(JSONObject object, JSONArray arrayID_nodos,String name){
        if (object.has(name)){
            if(noSeA_Actualizado_1(object, arrayID_nodos, name)){
                colorEstado("", name, "1");
            }else colorEstado("", name, "0");
        } else colorEstado("", name, "1");
    }
    private boolean noSeA_Actualizado_1(JSONObject object, JSONArray arrayID_nodos,String name){
        boolean existe = false;
        for (int i = 0; i < arrayID_nodos.length(); i++){
            try {
                JSONArray array = object.getJSONArray(name);
                for (int x = 0; x < array.length(); x++) {
                    JSONObject obj = array.getJSONObject(x);
                    if(obj.names().getString(0).equals(arrayID_nodos.getString(i))){
                        if(obj.getBoolean(arrayID_nodos.getString(i))){
                            existe = true; break;
                        }
                    }
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        return existe;
    }
    public void browseBluetoothDevice() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Si no tienes permisos, deten el flujo y pídelo antes de llamar a esta función.
            return;
        }

        final BluetoothConnection[] bluetoothDevicesList = (new BluetoothPrintersConnections()).getList();

        if (bluetoothDevicesList == null || bluetoothDevicesList.length == 0) {
            // Muestra un mensaje o un Toast indicando que no se encontraron dispositivos
            Toast.makeText(this, "No se encontraron dispositivos Bluetooth", Toast.LENGTH_SHORT).show();
            return;
        }

        final String[] items = new String[bluetoothDevicesList.length];
        for (int i = 0; i < bluetoothDevicesList.length; i++) {
            items[i] = bluetoothDevicesList[i].getDevice().getName();
        }

        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Selección de impresora Bluetooth")
                .setSingleChoiceItems(items, -1, null)
                .setPositiveButton("Aceptar", (dialog, which) -> {
                    AlertDialog alert = (AlertDialog) dialog;
                    int selectedPosition = alert.getListView().getCheckedItemPosition();
                    if (selectedPosition >= 0) {
                        // Selecciona el dispositivo elegido
                        selectedDevice_static = bluetoothDevicesList[selectedPosition];
                        saveSelectedDevice(selectedDevice_static);
                    }
                })
                .setNegativeButton("Cancelar", (dialog, which) -> dialog.dismiss());

        AlertDialog dialog = builder.create();
        dialog.setCanceledOnTouchOutside(false);
        dialog.show();
    }
    public void saveSelectedDevice(BluetoothConnection selectedDevice) {
        if (selectedDevice == null || selectedDevice.getDevice() == null) return;
        String macAddress = selectedDevice.getDevice().getAddress();
        SharedPreferences prefs = getSharedPreferences("MyAppSettings", MODE_PRIVATE);
        prefs.edit()
                .putString("SelectedPrinterMAC", macAddress)
                .apply();
    }
 /*
    static public void browseBluetoothDevice(Context context, Activity activity) {

        final BluetoothConnection[] bluetoothDevicesList = (new BluetoothPrintersConnections()).getList();

        if (bluetoothDevicesList != null) {
            final String[] items = new String[bluetoothDevicesList.length + 1];
            items[0] = "Default printer";
            int i = 0;
            for (BluetoothConnection device : bluetoothDevicesList) {
                if (ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                    // TODO: Consider calling
                    //    ActivityCompat#requestPermissions
                    // here to request the missing permissions, and then overriding
                    //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
                    //                                          int[] grantResults)
                    // to handle the case where the user grants the permission. See the documentation
                    // for ActivityCompat#requestPermissions for more details.
                    return;
                }
                items[++i] = device.getDevice().getName();
            }
            AlertDialog.Builder alertDialog = new AlertDialog.Builder(activity);
            alertDialog.setTitle("Bluetooth printer selection");
            alertDialog.setItems(
                    items,
                    (dialogInterface, i1) -> {
                        int index = i1 - 1;
                        if (index == -1) {
                            selectedDevice_static = null;
                        } else {
                            selectedDevice_static = bluetoothDevicesList[index];

                            SharedPreferences sharedPreferences = activity.getSharedPreferences("MisPreferencias", Context.MODE_PRIVATE);
                            SharedPreferences.Editor editor = sharedPreferences.edit();
                            editor.putString("bluetooth_device", selectedDevice_static != null ? selectedDevice_static.toString() : "");
                            editor.apply();
                        }
                    }
            );

            AlertDialog alert = alertDialog.create();
            alert.setCanceledOnTouchOutside(false);
            alert.show();
        }
    }
  */




}
