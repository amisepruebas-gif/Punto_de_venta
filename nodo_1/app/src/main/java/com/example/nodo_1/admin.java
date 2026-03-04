package com.example.nodo_1;

import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.saveData_sharedPreferences;
import static com.example.nodo_1.generales.toast;
//import static com.example.nodo_1.principal.browseBluetoothDevice;
import static descarga_init.descarga.escucharDarTicket;
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
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Switch;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import descarga_init.descarga;
import fragmentVenta.mas_vendidos;
import pop.pop3x2;
import pop.popAgergarNomCorte;
import pop.popCantidadPRecios;
import pop.popLoginCLip;
import pop.pop_informacionDeposito;

public class admin extends AppCompatActivity implements View.OnClickListener {


    boolean actualizarNomCorte          = false;
    boolean actualizarAutocompleteId    = false;
    @NonNull
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.admin_recursos);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        datosGuardados();
    }

    public void guardarDatosTransferencia(JSONObject object){
        saveData_sharedPreferences(getApplicationContext(), getString(R.string.transferencia_datos), getString(R.string.transferencia_datos),object.toString());
        subirDatos(getString(R.string.transferencia_datos), object.toString(), getString(R.string.transferencia_datos));
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
                            if(data.hasExtra("ingresoMercancia_actualizar_autoComplete"))
                            {
                                actualizarAutocompleteId = true;
                            }
                        }else toast("no paso 2", getApplicationContext());
                    }
                }
            });
    @Override
    public void onClick(View view) {
        if(R.id.but_nomCorte == view.getId()){
            pop.popAgergarNomCorte popAgergarNomCorte = new popAgergarNomCorte();
            popAgergarNomCorte.showPopupWindow(view, this);
        } else if (R.id.but_contraseña_admin == view.getId()) {
            pop.pop_pasword pop_pasword = new pop.pop_pasword();
            pop_pasword.showPopupWindow(view, null, this);
        } else if (R.id.butHist_Ventas == view.getId()) {
            Intent askIntent = new Intent(this, ventas.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.ventaPor_articulo == view.getId()) {
            Intent askIntent = new Intent(this, buscar_por_id.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.butArticulosPor_precio  == view.getId()) {
            pop.popCantidadPRecios popCantidadPRecios = new popCantidadPRecios();
            popCantidadPRecios.showPopupWindow(view);
        } else if (R.id.butAgregar_articulos == view.getId()) {
            Intent askIntent = new Intent(this, ingresoMercancia.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.butEditar_articulos == view.getId()) {
            Intent askIntent = new Intent(this, editar_articulos.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.but_descuento == view.getId()){
            //Intent askIntent = new Intent(this, generarDescuento.class);
            //someActivityResultLauncher.launch(askIntent);
        } else if (R.id.butPop_tallas == view.getId()) {
            //Intent askIntent = new Intent(this, tallas.class);
            //someActivityResultLauncher.launch(askIntent);
        } else if (R.id.but_ver3x2 == view.getId()){
            pop.pop3x2 pop3x2 = new pop3x2();
            pop3x2.showPopupWindow(view, admin.this);
        } else if (R.id.but_masvendido == view.getId()) {
            Intent askIntent = new Intent(this, mas_vendidos.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.but_ClipLogin == view.getId()) {
            pop.popLoginCLip popLoginCLip = new popLoginCLip();
            popLoginCLip.showPopupWindow(view);
        } else if (R.id.butEditar_ticket == view.getId()) {
            Intent askIntent = new Intent(this, editarTicket.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.but_informacionTransferencia == view.getId()) {
            pop.pop_informacionDeposito pop_informacionDeposito = new pop_informacionDeposito();
            pop_informacionDeposito.showPopupWindow(view, this);
        } else if (R.id.but_cambiar_conectar_impresora == view.getId()) {
            generales generales = new generales();
            generales.
                    browseBluetoothDevice(getApplicationContext());
        } else if (R.id.switch_LimitarVenta_a_existencia == view.getId()) {
            /** DESHABILITAR  3X2 CUANDO HAY DESCUENTO**/
            descarga.escucharLimitarExistencia = false;
            if(((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).isChecked()){
                saveData_sharedPreferences(getApplicationContext(), getString(R.string.limitarVenta_a_existencia), "limitarVenta_a_existencia", "1");
                subirDatos("limitarVenta_a_existencia", "1", "limitarVenta_a_existencia");
            }else {
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.limitarVenta_a_existencia), "limitarVenta_a_existencia","0");
                subirDatos("limitarVenta_a_existencia", "0", "limitarVenta_a_existencia");
            }
        } else if (R.id.switchMostrar3x2EnLaVenta == view.getId()) {
            descarga.escucharMostrar3x2 = false;
            /** 3X2 EN LA VENTA**/
            if(((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).isChecked()){
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.val_2x1_mostrar), getString(R.string.val_2x1_mostrar),"1");
                subirDatos(getString(R.string.val_2x1_mostrar), "1", getString(R.string.val_2x1_mostrar));
            }else {
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.val_2x1_mostrar), getString(R.string.val_2x1_mostrar),"0");
                subirDatos(getString(R.string.val_2x1_mostrar), "0", getString(R.string.val_2x1_mostrar));
            }
        } else if(R.id.switch_ReconocimientoFacial == view.getId()){
            descarga.escucharFacial = false;
            /**RECONOCIMIENTO FACIAL**/
            if(((Switch)findViewById(R.id.switch_ReconocimientoFacial)).isChecked()){
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.statusFacial), "facial","1");
                subirDatos("facial", "1", "facial");
            }else {
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.statusFacial), "facial","0");
                subirDatos("facial", "0", "facial");
            }
        } else if (R.id.switch_Cobrarcomision == view.getId()) {
            descarga.escucharCobrarComsion = false;
            /**COBRAR COMISION**/
            if(((Switch)findViewById(R.id.switch_Cobrarcomision)).isChecked()){
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.cobrar_comision), "cobrar_comision","1");
                subirDatos("cobrar_comision", "1", "cobrar_comision");
            }else {
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.cobrar_comision), "cobrar_comision","0");
                subirDatos("cobrar_comision", "0", "cobrar_comision");
            }
        } else if (R.id.switch_Dar_ticket == view.getId()) {
            /**DAR TICKET**/
            escucharDarTicket = false;
            if(((Switch)findViewById(R.id.switch_Dar_ticket)).isChecked()){
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.dar_ticket), "dar_ticket","1");
                subirDatos("dar_ticket", "1", "dar_ticket");
            }else {
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.dar_ticket), "dar_ticket","0");
                subirDatos("dar_ticket", "0", "dar_ticket");
            }
        } else if (R.id.switchMostrarBotonTransferencia == view.getId()) {
            descarga.escucharMsotrarBut_Transferencia = false;
            /**MOSTRAR BOTON TRANSFERENCIA**/
            if(((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).isChecked()){
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonTransferencia), "mostrarBotonTransferencia","1");
                subirDatos("mostrarBotonTransferencia", "1", "mostrarBotonTransferencia");
            }else {
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonTransferencia), "mostrarBotonTransferencia","0");
                subirDatos("mostrarBotonTransferencia", "0", "mostrarBotonTransferencia");
            }
        } else if (R.id.switchMostraBotonPagosConTarjeta == view.getId()) {
            descarga.escucharMsotrarBut_Tarjeta = false;
            /**MOSTRAR BOTON TARJETA**/
            if(((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).isChecked()){
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonPagoTarjeta), "mostrarBotonPagoTarjeta","1");
                subirDatos("mostrarBotonPagoTarjeta", "1", "mostrarBotonPagoTarjeta");
            }else {
                saveData_sharedPreferences(getApplicationContext(),  getString(R.string.mostrarBotonPagoTarjeta), "mostrarBotonPagoTarjeta","0");
                subirDatos("mostrarBotonPagoTarjeta", "0", "mostrarBotonPagoTarjeta");
            }
        }
    }



    private BroadcastReceiver updateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            try {
                String data = intent.getStringExtra("extra_data");
                String llave = intent.getStringExtra("datos");
                if(llave.equals(getString(R.string.val_2x1_mostrar))) {
                    JSONObject object = new JSONObject(data);
                    /** 3X2 EN LA VENTA**/
                    if(object.getString(getString(R.string.val_2x1_mostrar)).equals("1")){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.val_2x1_mostrar), getString(R.string.val_2x1_mostrar),"1");
                        ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(true);
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.val_2x1_mostrar), getString(R.string.val_2x1_mostrar),"0");
                        ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(false);
                    }
                } else if (llave.equals(getString(R.string.statusFacial))) {
                    JSONObject object = new JSONObject(data);
                    /** FACIAL **/
                    if(object.getString(getString(R.string.statusFacial)).equals("1")){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.statusFacial), "facial","1");
                        ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(true);
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.statusFacial), "facial","0");
                        ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(false);
                    }
                } else if (llave.equals("cobrar_comision")) {
                    JSONObject object = new JSONObject(data);
                    /** cobrar_comision **/
                    if(object.getString("cobrar_comision").equals("1")){
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.cobrar_comision), "cobrar_comision","1");
                        ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(true);
                    }else {
                        saveData_sharedPreferences(getApplicationContext(),  getString(R.string.cobrar_comision), "cobrar_comision","0");
                        ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(false);
                    }
                }else if (llave.equals("limitarVenta_a_existencia")) {
                    JSONObject object = new JSONObject(data);
                    /** cobrar_comision **/
                    if(object.getString("limitarVenta_a_existencia").equals("1")){
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.limitarVenta_a_existencia), "limitarVenta_a_existencia", "1");
                        ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(true);
                    }else {
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.limitarVenta_a_existencia), "limitarVenta_a_existencia", "0");
                        ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(false);
                    }
                } else if (llave.equals("dar_ticket")) {
                    JSONObject object = new JSONObject(data);
                    /** dar ticket **/
                    if(object.getString("dar_ticket").equals("1")){
                        escucharDarTicket = false;
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.dar_ticket), "dar_ticket", "1");
                        ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(true);
                    }else {
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.dar_ticket), "dar_ticket", "0");
                        ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(false);
                    }
                } else if (llave.equals("mostrarBotonTransferencia")) {
                    JSONObject object = new JSONObject(data);
                    /** dar ticket **/
                    if(object.getString("dar_ticket").equals("1")){
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonTransferencia), "mostrarBotonTransferencia", "1");
                        ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(true);
                    }else {
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonTransferencia), "mostrarBotonTransferencia", "0");
                        ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(false);
                    }
                } else if (llave.equals(getString(R.string.mostrarBotonPagoTarjeta))) {
                    JSONObject object = new JSONObject(data);
                    /** dar ticket **/
                    if(object.getString("mostrarBotonPagoTarjeta").equals("1")){
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonPagoTarjeta), "mostrarBotonPagoTarjeta", "1");
                        ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(true);
                    }else {
                        saveData_sharedPreferences(getApplicationContext(), getString(R.string.mostrarBotonPagoTarjeta), "mostrarBotonPagoTarjeta", "0");
                        ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(false);
                    }
                }

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    };
    @Override
    protected void onStart() {
        super.onStart();
        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_3x2");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_cobrar_comision");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_facial");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_limitarVenta_a_existencia");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_dar_ticket");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mostrarBotonTransferencia");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mostrarBotonPagoTarjeta");
        LocalBroadcastManager.getInstance(this).registerReceiver(updateReceiver, intentFilter);
    }

    @Override
    protected void onStop() {
        super.onStop();
        LocalBroadcastManager.getInstance(this).unregisterReceiver(updateReceiver);
    }
    public void subirDatos(String objKey, String objValue, String idDocument){
        JSONObject object = new JSONObject();
        try {
            object.put(objKey, objValue);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        fire.documenRef("datos/" + idDocument).
                set(new Gson().fromJson(
                        object.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                    @Override
                    public void onSuccess(Void unused) {
                        toast("DATOS ACTUALIZADOS", getApplicationContext());
                    }
                });
    }
    public void actualizarNomCortes(){
        actualizarNomCorte = true;
    }
    @Override
    public void onBackPressed() {
        Intent intent = new Intent(admin.this, principal.class);

        if(actualizarNomCorte)          intent.putExtra("admin_actualizarNomCorte", "1");
        if(actualizarAutocompleteId)    intent.putExtra("ingresoMercancia_actualizar_autoComplete", "1");
        setResult(RESULT_OK, intent);
        super.onBackPressed();
    }

    public void  datosGuardados(){
        /** 3X2 EN LA VENTA**/
        if(!generales.loadData_sharedPreferences(getApplicationContext(), getString(R.string.val_2x1_mostrar), getString(R.string.val_2x1_mostrar)).equals("0")){
            if(generales.loadData_sharedPreferences(getApplicationContext(), getString(R.string.val_2x1_mostrar), getString(R.string.val_2x1_mostrar)).equals("1")){
                ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(true);
            }else ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(false);
        }else  {
            if(generales.loadData_sharedPreferences(getApplicationContext(), getString(R.string.val_2x1_mostrar), getString(R.string.val_2x1_mostrar)).equals("0")){
                ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(false);
            }else ((Switch)findViewById(R.id.switchMostrar3x2EnLaVenta)).setChecked(true);
        }



        /**RECONOCIMIENTO FACIAL**/
        if(!generales.loadData_sharedPreferences(getApplicationContext(), "facial", getString(R.string.statusFacial)).equals("0")){
            if(generales.loadData_sharedPreferences(getApplicationContext(), "facial", getString(R.string.statusFacial)).equals("1")){
                ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(false);
        }else  {
            if(generales.loadData_sharedPreferences(getApplicationContext(), "facial", getString(R.string.statusFacial)).equals("0")){
                ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_ReconocimientoFacial)).setChecked(true);
        }


        /**COBRAR COMISION**/
        if(!generales.loadData_sharedPreferences(getApplicationContext(), "cobrar_comision", getString(R.string.cobrar_comision)).equals("0")){
            if(generales.loadData_sharedPreferences(getApplicationContext(), "cobrar_comision", getString(R.string.cobrar_comision)).equals("1")){
                ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(false);
        }else  {
            if(generales.loadData_sharedPreferences(getApplicationContext(), "cobrar_comision", getString(R.string.cobrar_comision)).equals("0")){
                ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_Cobrarcomision)).setChecked(true);
        }


        /**LIMITAR VENTA A EXISTENCIA**/
        if(!generales.loadData_sharedPreferences(getApplicationContext(), "limitarVenta_a_existencia", getString(R.string.limitarVenta_a_existencia)).equals("0")){
            if(generales.loadData_sharedPreferences(getApplicationContext(), "limitarVenta_a_existencia", getString(R.string.limitarVenta_a_existencia)).equals("1")){
                ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(false);
        }else  {
            if(generales.loadData_sharedPreferences(getApplicationContext(), "limitarVenta_a_existencia", getString(R.string.limitarVenta_a_existencia)).equals("0")){
                ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_LimitarVenta_a_existencia)).setChecked(true);
        }


        /**DAR TICKET**/
        if(!loadData_sharedPreferences(getApplicationContext(), "dar_ticket", getString(R.string.dar_ticket)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), "dar_ticket", getString(R.string.dar_ticket)).equals("1")){
                ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(true);
            }else ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), "dar_ticket", getString(R.string.dar_ticket)).equals("0")){
                ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(false);
            }else ((Switch)findViewById(R.id.switch_Dar_ticket)).setChecked(true);
        }


        /**mostrarBotonPagoTarjeta**/
        if(!loadData_sharedPreferences(getApplicationContext(), "mostrarBotonPagoTarjeta", getString(R.string.mostrarBotonPagoTarjeta)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), "mostrarBotonPagoTarjeta", getString(R.string.mostrarBotonPagoTarjeta)).equals("1")){
                ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(true);
            }else ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), "mostrarBotonPagoTarjeta", getString(R.string.mostrarBotonPagoTarjeta)).equals("0")){
                ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(false);
            }else ((Switch)findViewById(R.id.switchMostraBotonPagosConTarjeta)).setChecked(true);
        }


        /**mostrarBotonTransferencia**/
        if(!loadData_sharedPreferences(getApplicationContext(), "mostrarBotonTransferencia", getString(R.string.mostrarBotonTransferencia)).equals("0")){
            if(loadData_sharedPreferences(getApplicationContext(), "mostrarBotonTransferencia", getString(R.string.mostrarBotonTransferencia)).equals("1")){
                ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(true);
            }else ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(false);
        }else  {
            if(loadData_sharedPreferences(getApplicationContext(), "mostrarBotonTransferencia", getString(R.string.mostrarBotonTransferencia)).equals("0")){
                ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(false);
            }else ((Switch)findViewById(R.id.switchMostrarBotonTransferencia)).setChecked(true);
        }

    }
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
}
