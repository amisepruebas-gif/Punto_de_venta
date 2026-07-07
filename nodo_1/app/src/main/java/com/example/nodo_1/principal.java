package com.example.nodo_1;


//Project Console: https://console.firebase.google.com/project/sample-firebase-ai-app-4e47b/overview
//

import static android.content.ContentValues.TAG;
import static com.example.nodo_1.fire.db;
import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.saveData_sharedPreferences;
import static com.example.nodo_1.generales.toast;
import static pagoTarjeta.uno.selectedDevice_static;
import static pop.popLoginCLip.isValidEmail;
import static pop.pop_corte.key_corte;
import static pop.pop_corte.name_corte;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import androidx.recyclerview.widget.RecyclerView;

//import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
//import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.firebase.firestore.CollectionReference;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.FirebaseFirestoreSettings;
import com.google.gson.Gson;
/*
import com.payclip.common.StatusCode;
import com.payclip.dspread.ClipPlusApi;
import com.payclip.paymentui.client.ClipApi;
import com.payclip.paymentui.client.LoginListener;
import com.payclip.paymentui.models.ClipPayment;
 */
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TimeZone;
import java.util.concurrent.Executor;

import adapter.adapEnturno;
import adapter.adapRegVenta;
import descarga_init.descarga;
import helper.SwipeHelper;
import internet.NetworkMonitor;
import pop.confirmar_pago_cambio_a_trans;
import pop.popArtNoRegistrado;
import pop.popPagoDividido;
import pop.popPagoTrans_NoConcretada;
import pop.popVariacion_venta;
import pop.pop_administrador_contraseña;
import pop.pop_barcode_imprimir;
import pop.pop_corte;
import pop.pop_mensajes;
import pop.popcambio_forma_pago_dividido;
import pop.preguntar_salir_app;
import pop.ticketDigital;
import pop.ventaRealizada;


public class principal extends AppCompatActivity implements View.OnClickListener, SlidingUpPanelLayout.PanelSlideListener , NetworkMonitor.NetworkChangeListener{

    public static JSONObject jsonVenta_actual = new JSONObject();
    JSONObject jsonVentGuardada = new JSONObject();

    public static String     idUltimaVenta = "0";
    public static JSONObject objectFechasVenta = new JSONObject();
    public static JSONObject objectFechasMensaje = new JSONObject();
    public static JSONObject jsonArticulos          = new JSONObject();
    public static JSONObject jsonDatos              = new JSONObject();
    public static JSONObject jsonVenta              = new JSONObject();
    public static JSONObject jsonMensajes           = new JSONObject();
    public static JSONObject jsonMensajes_n         = new JSONObject();
    public static JSONObject jsonSiglas             = new JSONObject();
    public static JSONObject jsonPedido             = new JSONObject();
    public static JSONObject jsonClientes           = new JSONObject();
    public static JSONObject jsonNamFunkos          = new JSONObject();
    public static JSONObject jsonNamPersonajes      = new JSONObject();
    public static JSONObject jsonVentaXarticulo     = new JSONObject();
    public static JSONObject jsonCorteHistorial     = new JSONObject();
    public static JSONObject objectFechasCorte      = new JSONObject();
    public static JSONObject jsonStatusUpdate       = new JSONObject();


    public static ArrayList<String> años = new ArrayList<>();
    public static ArrayList<ArrayList<String>> meses = new ArrayList<>();

    BluetoothAdapter mBluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    private static final int CODIGO_PERMISOS_BLUETHOT = 1;
    public static final int  PERMISSION_BLUETOOTH = 1;
    //----------------------------------------Sliding Panel
    public static SlidingUpPanelLayout sliding;

    //----------------------------------------AutoCompleteTerxtView
    AutoCompleteTextView autoComplete_codigoArt;

    //----------------------------------------Recycler
    RecyclerView recyclerItemsVenta;
    //----------------------------------------

    //----------------------------------------Adapteer
    adapter.adapRegVenta adapRegVenta;
    //----------------------------------------
    //----------------------------------------TextView
    TextView total_principal;
    TextView txt_comicion_tarjeta, txt_total_tarjeta;
    TextView enTurno, texPagoDiv, txtRestaPagoDiv;
    TextView palomaPagoDiv, texto_resta_pagoDiv;
    TextView cambioPago_tarjeta_comision, cambioPago_Tarjeta_GranTotal,
            cambioPago_checkTrans;
    TextView cambioPago_trans, cambioPAgo_Titulo;

    TextView txtBotonPagoTarjeta;
    TextView txtIngresoDia;
    //----------------------------------------
    //----------------------------------------EditText
    EditText montoPago;
    //----------------------------------------ConstraiLayout
    ConstraintLayout consPagoConTarjeta, cons_info_trans, consPagoDividido_abajo, consPAgoTarjetaBoton;
    ConstraintLayout consCambioFormaPago, consCambioPago_Tarjeta, consCambioPago_Trans;
    //----------------------------------------Button
    Button butMasUnaVenta, butPagoDividido, butPagoTarjeta, butTransferencia, imp_TicketTrans_norm;
    Button butPagoIgual, butcambiarFormaDePago, butConfTransferencia;
    Button pagarConTarjeta_cambioPago, but_cobrar;


    public static String huella_venta_registro  = "";
    static public String huellaMensaje_generada = "";
    public static String huella_corte_1_static  = "";
    //----------------------------------------variables
    public static String pagoEfectivo = "pagoEfectivo", pagoTarjeta = "pagoTarjeta";
    public static String pagoTransferencia = "pagoTransferencia", pagoDividido = "pagoDividido";
    public static String movimiento = "movimiento", datosPagoDividido = "datos_pago_dividido";

    public  static String escalon_pago_div = "escalon_pago_div";

    //----------------------------------------Usuario
    private NetworkMonitor networkMonitor;
    //----------------------------------------
    public static boolean boleanActividad_status;

    public static boolean unaVezHiloEscuchar = false;
    static int cont = 0, cont2 = 0;

    /** JSON_VENTA VER NAMES**/
    adapter.adap_nom_id_jsonventa adap_nom_id_jsonventa;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.principal);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        // Restore negocioId for multi-tenant isolation
        String savedNegocioId = fire.restoreNegocioId(getApplicationContext());
        if (savedNegocioId == null || savedNegocioId.isEmpty()) {
            // No negocioId - redirect to login
            Intent loginIntent = new Intent(this, initLog.class);
            startActivity(loginIntent);
            finish();
            return;
        }

        descarga descarga = new descarga(getApplicationContext(), this, internet.NetworkUtil.isNetworkAvailable(getApplicationContext()));

        DeviceIdentifier.getOrRecover(getApplicationContext(), new DeviceIdentifier.OnDeviceIdReady() {
            @Override
            public void onReady(String deviceId) {
                init(descarga);
            }

            @Override
            public void onNeedsRegistration(String androidId) {
                descarga.descargarDatosInit();
            }

            @Override
            public void onError(String error) {
                descarga.descargarDatosInit();
            }
        });
    }
    public void initUser(){
        Intent askIntent = new Intent(principal.this, registro_dispositivo.class);
        someActivityResultLauncher.launch(askIntent);
    }
    private void init(descarga descarga){
        //ClipApi.init(getApplication(), new ClipPlusApi());
        RecyclerView recyclerView = (RecyclerView)findViewById(R.id.recyclerView2);
        generales.recyclerVertical(recyclerView, getApplicationContext());
        adap_nom_id_jsonventa = new  adapter.adap_nom_id_jsonventa();
        recyclerView.setAdapter(adap_nom_id_jsonventa);

        sliding = (SlidingUpPanelLayout) findViewById(R.id.sliding_nuevoMenu);
        sliding.setDragView(null);
        sliding.addPanelSlideListener(this);

        consPagoConTarjeta          = (ConstraintLayout) findViewById(R.id.consPagoConTarjeta);
        cons_info_trans             = (ConstraintLayout) findViewById(R.id.consInformacionDepagoa);
        consPagoDividido_abajo      = (ConstraintLayout) findViewById(R.id.constraintLayout6);
        consPAgoTarjetaBoton        = (ConstraintLayout) findViewById(R.id.consPAgoTarjetaBoton);
        consCambioFormaPago         = (ConstraintLayout) findViewById(R.id.constraintLayout7);
        consCambioPago_Tarjeta      = (ConstraintLayout) findViewById(R.id.consPagoConTarjeta_cambio_pago);
        consCambioPago_Trans        = (ConstraintLayout) findViewById(R.id.consCambioForma_Tarjeta);


        total_principal             = (TextView) findViewById(R.id.textViewGranTotal);
        enTurno                     = (TextView) findViewById(R.id.textView10);
        texPagoDiv                  = (TextView) findViewById(R.id.retornoUTL);
        txtRestaPagoDiv             = (TextView) findViewById(R.id.textViewGranTotal7);
        palomaPagoDiv               = (TextView) findViewById(R.id.textView37);
        texto_resta_pagoDiv         = (TextView) findViewById(R.id.textView38);
        cambioPago_tarjeta_comision = (TextView) findViewById(R.id.textViewGranTotal4_cambio_pago);
        cambioPago_Tarjeta_GranTotal= (TextView) findViewById(R.id.textViewGranTotal6_cambio_pago);
        cambioPago_checkTrans       = (TextView) findViewById(R.id.textView56);
        cambioPago_trans            = (TextView) findViewById(R.id.textView55);
        cambioPAgo_Titulo           = (TextView) findViewById(R.id.textView53);
        txtBotonPagoTarjeta         = (TextView) findViewById(R.id.textView397);
        txtIngresoDia               = (TextView) findViewById(R.id.txtIngresoDia);

        montoPago                   = (EditText) findViewById(R.id.textviewMontoPago);

        recyclerItemsVenta          = (RecyclerView) findViewById(R.id.recyclerItemsVenta);

        butMasUnaVenta              = (Button) findViewById(R.id.button201);butMasUnaVenta.setVisibility(View.GONE);
        butPagoDividido             = (Button) findViewById(R.id.button144);
        butPagoTarjeta              = (Button) findViewById(R.id.button123);
        butTransferencia            = (Button) findViewById(R.id.button199);
        butPagoIgual                = (Button) findViewById(R.id.button118);
        butcambiarFormaDePago       = (Button) findViewById(R.id.button13);
        butConfTransferencia        = (Button) findViewById(R.id.button8);
        imp_TicketTrans_norm        = (Button) findViewById(R.id.button17);
        pagarConTarjeta_cambioPago  = (Button) findViewById(R.id.button23);
        but_cobrar                  = (Button) findViewById(R.id.cobrar);

        txt_comicion_tarjeta        = (TextView) findViewById(R.id.textViewGranTotal4);
        txt_total_tarjeta           = (TextView) findViewById(R.id.textViewGranTotal6);

        generales.recyclerVertical(recyclerItemsVenta, getApplicationContext());
        iniciarAdapRegVenta();
        recyclerItemsVenta.setAdapter(adapRegVenta);

        autoComplete_codigoArt = (AutoCompleteTextView) findViewById(R.id.autoCompleteBusqedaAgrgarCliente);

        mensajeRecibidoAlIniciar();
        selecItem_autoComplete_codigoArt();
        swipRegVenta();
        FirebaseFirestoreSettings settings = new FirebaseFirestoreSettings.Builder()
                .setPersistenceEnabled(true)
                .build();
        fire.db().setFirestoreSettings(settings);

        networkMonitor = new NetworkMonitor(this, this);
        descarga.descargaInit();
        verificarPermisoNotificaciones();
        push.FcmTokenManager.inicializar(getApplicationContext());
        activarBluetooth();
        infoPago_trans();
        //restoreSelectedDeviceIfExists();

        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);

        //checkOrSelectUsbDevice();
    }
    private static final String PREFS_NAME = "UsbPrefs";
    private static final String KEY_VENDOR_ID = "vendorId";
    private static final String KEY_PRODUCT_ID = "productId";

    private void checkOrSelectUsbDevice() {
        // 1) Si no hay nada guardado, pedimos que seleccione
        if (hasSavedDevice()) {
            showDeviceSelectionDialog();
            return;
        }

        // 2) Si hay algo guardado, obtenemos VendorId y ProductId
        int[] savedIds = getSavedDeviceFromPrefs();
        int savedVendorId = savedIds[0];
        int savedProductId = savedIds[1];

        // 3) Verificamos si ese dispositivo está conectado
        UsbDevice savedDevice = findDevice(savedVendorId, savedProductId);
        if (savedDevice == null) {
            // No está conectado o no existe, entonces pedimos que seleccione otro
            Toast.makeText(this, "El dispositivo guardado no está disponible. Selecciona otro.", Toast.LENGTH_SHORT).show();
            showDeviceSelectionDialog();
        } else {
            // Está conectado, podemos pedir permiso e iniciar el proceso
            Toast.makeText(this, "Usando dispositivo guardado (VendorId=" + savedVendorId + ")", Toast.LENGTH_SHORT).show();
            // En este punto NO enviamos TSPL todavía si no lo necesitas.
            // Solo solicitamos el permiso si queremos ya dejarlo listo para imprimir.
            requestUsbPermission(savedDevice, null);
            // Nota: "null" si no tienes un tsplCommand en este momento.
            // Cuando vayas a imprimir, ya tendrás un dispositivo abierto.
        }
    }
    private void requestUsbPermission(UsbDevice device, String tsplCommand) {
        // Guardamos la cadena en un campo o la pasamos de otra forma
        this.pendingTsplCommand = tsplCommand;  // variable global o local

        PendingIntent permissionIntent = PendingIntent.getBroadcast(
                this,
                0,
                new Intent(ACTION_USB_PERMISSION),
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                        ? PendingIntent.FLAG_IMMUTABLE
                        : 0
        );
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        registerReceiver(usbReceiver, filter);
        usbManager.requestPermission(device, permissionIntent);
    }
    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
                synchronized (this) {
                    UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        if (device != null) {
                            usbConnection = usbManager.openDevice(device);
                            if (usbConnection != null) {
                                t( "Conexión USB abierta. Enviando TSPL...");
                               // sendTspl(usbConnection, device, pendingTsplCommand);
                            } else {
                                t("No se pudo abrir la conexión USB");
                            }
                        }
                    } else {
                        t("Permiso denegado para el dispositivo USB.");
                    }
                    unregisterReceiver(this);
                }
            }
        }
    };
    private void saveDeviceToPrefs(int vendorId, int productId) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putInt(KEY_VENDOR_ID, vendorId);
        editor.putInt(KEY_PRODUCT_ID, productId);
        editor.apply();
    }

    private int[] getSavedDeviceFromPrefs() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        int vendorId = prefs.getInt(KEY_VENDOR_ID, -1);
        int productId = prefs.getInt(KEY_PRODUCT_ID, -1);

        // Si regresa [-1, -1], significa que no hay nada guardado
        return new int[]{vendorId, productId};
    }

    private boolean hasSavedDevice() {
        int[] saved = getSavedDeviceFromPrefs();
        // Revisamos si no es -1
        return (saved[0] != -1 && saved[1] != -1);
    }

    private void showDeviceSelectionDialog() {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        if (deviceList.isEmpty()) {
            Toast.makeText(this, "No se encontraron dispositivos USB", Toast.LENGTH_SHORT).show();
            return;
        }

        final List<UsbDevice> devices = new ArrayList<>(deviceList.values());
        String[] deviceNames = new String[devices.size()];
        for (int i = 0; i < devices.size(); i++) {
            UsbDevice d = devices.get(i);
            deviceNames[i] = d.getDeviceName()
                    + " (Vendor: " + d.getVendorId()
                    + ", Product: " + d.getProductId() + ")";
        }

        new AlertDialog.Builder(this)
                .setTitle("Selecciona tu impresora USB")
                .setItems(deviceNames, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        UsbDevice selectedDevice = devices.get(which);
                        currentUsbDevice = selectedDevice;
                        // Guardamos en SharedPreferences
                        saveDeviceToPrefs(selectedDevice.getVendorId(), selectedDevice.getProductId());
                        // Solicitamos permiso
                        requestUsbPermission(selectedDevice, null);
                    }
                })
                .setCancelable(false)
                .show();
    }
    private UsbDevice currentUsbDevice = null;
    private void swipRegVenta(){
        adapRegVenta.swip(
                new SwipeHelper(getApplicationContext(), recyclerItemsVenta) {
                    @Override
                    public void instantiateUnderlayButton(RecyclerView.ViewHolder viewHolder, List<UnderlayButton> underlayButtons) {

                        underlayButtons.add(new UnderlayButton(
                                "DESCARTAR",
                                1,
                                Color.parseColor("#FF3C30"),
                                new UnderlayButtonClickListener() {
                                    @Override
                                    public void onClick(int pos) {
                                        adapRegVenta.remove(pos);
                                        if(estadoSwip_1){
                                            recoverQueue.add(swipedPos);
                                            swipedPos = -1;

                                            while (!recoverQueue.isEmpty()){
                                                int pos_swip = recoverQueue.poll();
                                                if (pos_swip > -1) {
                                                    recyclerItemsVenta.getAdapter().notifyItemChanged(pos_swip);
                                                }
                                            }
                                        }
                                    }
                                }
                        ));
                    }
                }
        );
    }
    private void iniciarAdapRegVenta (){
        adapRegVenta = new adapRegVenta(
                getApplicationContext(),
                recyclerItemsVenta,
                total_principal,
                this,
                null,
                ((Button)findViewById(R.id.butCancelarVenta)));
    }

    pop.pop_mensajes pop_mensajes;

    JSONObject objDatosCliente = new JSONObject();
    JSONObject objDatosApartado = new JSONObject();

    ActivityResultLauncher<Intent> someActivityResultLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            new ActivityResultCallback<ActivityResult>() {
                @Override
                public void onActivityResult(ActivityResult result) {
                    if (result.getResultCode() == Activity.RESULT_OK) {

                        boolean nuevoDisp = false;

                        Intent data = result.getData();

                        if(data != null){
                            if(data.hasExtra("ingresoMercancia_actualizar_autoComplete"))
                            {
                                actualizarAutocomplete();
                            } else if (data.hasExtra("admin_actualizarNomCorte")){
                                actualizarListaUsuariosCorte();
                            } else if (data.hasExtra("pedidos_1")) {
                                String pedidos1Value = data.getStringExtra("pedidos_1");
                                try {
                                    assert pedidos1Value != null;
                                    JSONObject obj_1 = new JSONObject(pedidos1Value);
                                    objDatosCliente = obj_1.getJSONObject("cliente");
                                    objDatosApartado= obj_1.getJSONObject("apartado");

                                    JSONObject datosAp = new JSONObject();
                                    datosAp.put("precio",   objDatosApartado.getString("anticipo"));
                                    datosAp.put("numeroAp", objDatosApartado.getString("numAp"));
                                    datosAp.put("nombreAP", objDatosCliente.getString( "nombre"));
                                    datosAp.put("descripcion", "APARTADO");
                                    datosAp.put("cantidad","1");

                                    if(objDatosApartado.has("nuevocl"))jsonVenta_actual.put("nuevocl", "");
                                    if(objDatosApartado.has("nuevoap"))jsonVenta_actual.put("nuevoap", "");


                                    adapRegVenta.add(datosAp, false);
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            }else if (data.hasExtra("pedidos_2")) {
                                try {
                                    String pedidos1Value = data.getStringExtra("pedidos_2");
                                    objDatosApartado = new JSONObject(pedidos1Value);
                                    objDatosApartado.put("abono", "");

                                    JSONObject datosAp = new JSONObject();
                                    datosAp.put("precio",   objDatosApartado.getString("anticipo"));
                                    datosAp.put("numeroAp", objDatosApartado.getString("numAp"));
                                    datosAp.put("nombreAP", objDatosApartado.getString( "nombre"));
                                    datosAp.put("descripcion", "APARTADO ABONO");
                                    datosAp.put("cantidad","1");

                                    jsonVenta_actual.put("abono", "");

                                    adapRegVenta.add(datosAp, false);
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            }else if (data.hasExtra("pedidos_3")) {
                                try {
                                    String pedidos1Value = data.getStringExtra("pedidos_3");
                                    objDatosApartado = new JSONObject(pedidos1Value);
                                    objDatosApartado.put("abono", "");

                                    JSONObject datosAp = new JSONObject();
                                    datosAp.put("precio",   objDatosApartado.getString("anticipo"));
                                    datosAp.put("numeroAp", objDatosApartado.getString("numAp"));
                                    datosAp.put("nombreAP", objDatosApartado.getString( "nombre"));
                                    datosAp.put("descripcion", "APARTADO ABONO");
                                    datosAp.put("cantidad","1");

                                    jsonVenta_actual.put("liquidacion_apartado", "");

                                    adapRegVenta.add(datosAp, false);
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            } else if (data.hasExtra("registroExitoso")) {
                                descarga descarga =
                                        new descarga(
                                                getApplicationContext(),
                                                principal.this,
                                                internet.NetworkUtil.isNetworkAvailable(getApplicationContext()));
                                if(data.getStringExtra("registroExitoso").equals("1")){

                                    init(descarga);

                                } else {
                                    descarga.descargarDatosInit();
                                }
                                nuevoDisp = true;
                            }
                            if(!nuevoDisp)sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                        }
                    }
                }
            });
    private void actualizarListaUsuariosCorte(){
        RecyclerView recyclerView = (RecyclerView) findViewById(R.id.recyclerView_equipoTrabajo);
        generales.recyclerVertical(recyclerView, getApplicationContext());
        List<String> list = new ArrayList<>();
        try {
            JSONArray array = jsonDatos.getJSONArray("nombresCorte");
            for(int y = 0; y < array.length(); y++){
                list.add(array.getString(y));
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        adapter.adapEnturno adapEnturno = new  adapEnturno(this, list, getApplicationContext());
        recyclerView.setAdapter(adapEnturno);

    }
    public void adminInit_corte(){
        ((Button)findViewById(R.id.button40)).setVisibility(View.VISIBLE);
    }
    public void initClasAdmin(){
        Intent askIntent = new Intent(this, administrador.class);
        someActivityResultLauncher.launch(askIntent);
    }

    int billete = 0;

    public boolean reconocimientoFacial(){
        boolean estado;
        /** RECONOCIMIENTO FACIAL **/
        if(generales.loadData_sharedPreferences(getApplicationContext(), "facial", getApplicationContext().getString(R.string.statusFacial)).equals("0")
                ||generales.loadData_sharedPreferences(getApplicationContext(), "facial", getString(R.string.statusFacial)).equals("")
        )estado=false;
        else estado = true;
        return estado;
    }
    public boolean comisionTarjeta(){
        boolean estado;
        /** COBRAR COMISION **/
        if(generales.loadData_sharedPreferences(getApplicationContext(), "cobrar_comision", getApplicationContext().getString(R.string.cobrar_comision)).equals("0")
                ||generales.loadData_sharedPreferences(getApplicationContext(), "cobrar_comision", getString(R.string.cobrar_comision)).equals("")
        )estado=false;
        else estado = true;
        return estado;
    }
    public boolean darTicket(){
        boolean estado;
        /** Dar ticket **/
        if(generales.loadData_sharedPreferences(getApplicationContext(), "dar_ticket", getApplicationContext().getString(R.string.dar_ticket)).equals("0")
                ||generales.loadData_sharedPreferences(getApplicationContext(), "dar_ticket", getString(R.string.dar_ticket)).equals("")
        )estado=false;
        else estado = true;
        return estado;
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
                        object.toString(), HashMap.class));
    }
    private void but_switch(int id, View v){

        Drawable d = null; int color=0;

        if (R.id.butBilleteVeinte == id) {
            quitarMArcadorBillete();
            moverMarcadorBillete(20);
            ((TextView) findViewById(R.id.butBilleteVeinte2)).setVisibility(View.VISIBLE);
            billete = 20;
        } else if (R.id.butBilleteCincuenta == id) {
            quitarMArcadorBillete();
            moverMarcadorBillete(50);
            ((TextView) findViewById(R.id.butBilleteCincuenta2)).setVisibility(View.VISIBLE);
            billete = 50;
        } else if (R.id.butBilleteCien == id) {
            quitarMArcadorBillete();
            moverMarcadorBillete(100);
            ((TextView) findViewById(R.id.butBilleteCien2)).setVisibility(View.VISIBLE);
            billete = 100;
        } else if (R.id.butBilleteDocientos == id) {
            quitarMArcadorBillete();
            moverMarcadorBillete(200);
            ((TextView) findViewById(R.id.butBilleteDocientos2)).setVisibility(View.VISIBLE);
            billete = 200;
        } else if (R.id.butBilleteQuinientos == id) {
            quitarMArcadorBillete();
            moverMarcadorBillete(500);
            ((TextView) findViewById(R.id.butBilleteQuinientos2)).setVisibility(View.VISIBLE);
            billete = 500;
        } else if (R.id.butBilleteMil == id) {
            quitarMArcadorBillete();
            moverMarcadorBillete(1000);
            ((TextView) findViewById(R.id.butBilleteMil2)).setVisibility(View.VISIBLE);
            billete = 1000;
        } else if (R.id.butMenuMainActivity == id) {
            sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
        } else if (R.id.button173 == id) {
            pop_corte pop_corte_uno = new pop_corte();
            pop_corte_uno.showPopupWindow(v, enTurno.getText().toString());
        } else if (R.id.button24 == id) {
            Intent askIntent = new Intent(this, pedidos.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.button25 == id) {
            String enturno = "" ;
            if (enTurno.length() > 0){
                enturno = enTurno.getText().toString();
            }
            boolean estado = false;
            boolean nohayContraseña = false;
            if(!generales.loadData_sharedPreferences(getApplicationContext(), "pasAdmin", getString(R.string.passAdmin)).equals("")
                    &&
                    !generales.loadData_sharedPreferences(getApplicationContext(), "pasAdmin", getString(R.string.passAdmin)).equals("0")){
                estado = true;
            }else {
                if (generales.loadData_sharedPreferences(getApplicationContext(), "pasAdmin", getString(R.string.passAdmin)).equals("")){
                    nohayContraseña = true;
                }
            }

            if(reconocimientoFacial() && estado){
                androidx.biometric.BiometricPrompt.PromptInfo promptInfo;
                Executor executor = ContextCompat.getMainExecutor(this);

                androidx.biometric.BiometricPrompt biometricPrompt = getBiometricPrompt(v, enturno, executor);

                promptInfo = new androidx.biometric.BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Autenticación biométrica")
                        .setSubtitle("Utiliza tu rostro para acceder")
                        .setNegativeButtonText("Cancelar")
                        .build();

                // Inicia la autenticación biométrica
                biometricPrompt.authenticate(promptInfo);
            }else {
                if (nohayContraseña){
                    pop.pop_pasword pop_pasword = new pop.pop_pasword();
                    pop_pasword.showPopupWindow(v, this, null);
                }else {
                    pop.pop_administrador_contraseña popAdmin = new pop_administrador_contraseña();
                    popAdmin.showPopupWindow(v, enturno, principal.this);
                }
            }
        } else if (R.id.button22 == id) {
            reset();
            adapRegVenta.vaciar();
            jsonVenta_actual = new JSONObject();
            adap_nom_id_jsonventa.actualizar();
        } else if (R.id.button21 == id) {/** VER ID (NAMES) JSN_VENTA **/
            adap_nom_id_jsonventa.actualizar();
        } else if (R.id.button70Mensaje == id) {/**   MENSAJES  **/

            String idDispositivo = generales.loadData_sharedPreferences(getApplicationContext(), "id_mensaje", "dispositivo");
            if(jsonDatos.length() > 0){
                if (jsonDatos.has("dispositivos_mensaje") && !idDispositivo.equals("")) {
                    ((Button) findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.baseline_message_24));
                    generales.removeData_sharedPreferences(getApplicationContext(), "key_cant_mensaje", "mensaje");
                    TextView textView = (TextView) findViewById(R.id.textView_mensaje);
                    textView.setVisibility(View.GONE);
                    textView.setText("");
                    generales.removeData_sharedPreferences(getApplicationContext(), "key_cant_mensaje", "mensaje");
                    pop_mensajes = new pop_mensajes();
                    String name = "SIN ASIGNAR";
                    if(enTurno.length() >0)name = enTurno.getText().toString();
                    pop_mensajes.showPopupWindow(v, name, idDispositivo);
                } else {
                    generales.intent(registro_dispositivo.class, getApplicationContext(), "", "");
                }
            }else {
                generales.intent(registro_dispositivo.class, getApplicationContext(), "", "");
            }

        } else if (R.id.button201 == id) {/**   VENTA MAS  **/
            d = getResources().getDrawable(R.drawable.medio_red_morado);
            color = ContextCompat.getColor(getApplicationContext(), R.color.blanco);
            if (jsonVentGuardada.length() > 0) {
                selecPago("jsn");
                try {
                    jsonVenta_actual = new JSONObject(jsonVentGuardada.toString());
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                jsonVentGuardada = new JSONObject();
                if (jsonVenta_actual.has(movimiento)) {
                    try {
                        if (jsonVenta_actual.getString(movimiento).equals(pagoTransferencia)) {
                            butTransferencia.setTextColor(color);
                            butTransferencia.setBackgroundDrawable(d);
                            cons_info_trans.setVisibility(View.VISIBLE);
                            butConfTransferencia.setVisibility(View.VISIBLE);
                        }
                        if (jsonVenta_actual.getString(movimiento).equals(pagoDividido)) {
                            butPagoDividido.setTextColor(color);
                            butPagoDividido.setBackgroundDrawable(d);
                            if (jsonVenta_actual.has(pagoDividido)) {
                                /** YA SE HA SELECCIONADO UNA OPCION DE PAGO DIVIDIDO  **/
                                /** SOLO SELCCION LA CONFIRMACION ESTA COMO -> ESCALON.**/
                                /** SOLO PUEDE GUARDARSE LA VENTA EN ANTES DEL 1º
                                 * CONFIRMACION  **/
                                if (jsonVenta_actual.getString(pagoDividido).equals("TRANSFERENCIA")) {
                                    cons_info_trans.setVisibility(View.VISIBLE);
                                    montoPago.setEnabled(false);
                                    butTransferencia.setBackgroundDrawable(getResources().getDrawable(R.drawable.medio_red_morado));
                                    butTransferencia.setTextColor(ContextCompat.getColor(getApplicationContext(), R.color.blanco));
                                    consPagoDividido_abajo.setVisibility(View.VISIBLE);
                                    butConfTransferencia.setVisibility(View.VISIBLE);
                                    consPagoDividido_abajo.setVisibility(View.VISIBLE);
                                }
                            }
                        }
                        if (jsonVenta_actual.getString(movimiento).equals(pagoTarjeta)) {
                            ConstraintLayout consPAgoTarjetaBoton = (ConstraintLayout) findViewById(R.id.consPAgoTarjetaBoton);
                            TextView textView = (TextView) findViewById(R.id.textView397);
                            consPAgoTarjetaBoton.setBackgroundDrawable(d);
                            textView.setTextColor(color);
                            consPagoConTarjeta.setVisibility(View.VISIBLE);
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }

                }
                try {
                    adapRegVenta.llenar(jsonVenta_actual.getJSONArray("articulos"));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                d = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
                color = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);
            } else {
                if (adapRegVenta.getItemCount() > 0) {
                    try {
                        jsonVentGuardada = new JSONObject(jsonVenta_actual.toString());
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    try {
                        jsonVentGuardada.put("articulos", adapRegVenta.getArray());
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    adapRegVenta.vaciar();
                    selecPago("");
                    jsonVenta_actual = new JSONObject();
                    d = getResources().getDrawable(R.drawable.cuadro_esq_red_rojo_suave);
                    color = ContextCompat.getColor(getApplicationContext(), R.color.blanco);
                }
            }
            if (d != null) {
                butMasUnaVenta.setBackgroundDrawable(d);
                butMasUnaVenta.setTextColor(color);
            }
            adap_nom_id_jsonventa.actualizar();
        } else if (R.id.button199 == id) {
            /** PAGO TRANSFERENCIA **/
            if (adapRegVenta.getItemCount() > 0) {
                selecPago(pagoTransferencia);
                if (estadoSelec(pagoTransferencia)) {
                    try {
                        jsonVenta_actual.put(movimiento, pagoEfectivo);
                        d = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
                        color = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);
                        cons_info_trans     .setVisibility(View.GONE);
                        butConfTransferencia.setVisibility(View.GONE);
                        jsonVenta_actual.remove(movimiento);
                        montoPago.setEnabled(true);
                        montoPago.setText("");
                        consPAgoTarjetaBoton.setVisibility(View.VISIBLE);
                        butPagoIgual        .setVisibility(View.VISIBLE);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }

                } else {
                    try {
                        jsonVenta_actual.put(movimiento, pagoTransferencia);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    d = getResources().getDrawable(R.drawable.medio_red_morado);
                    color = ContextCompat.getColor(getApplicationContext(), R.color.blanco);
                    cons_info_trans.setVisibility(View.VISIBLE);
                    montoPago.setEnabled(false);
                    montoPago.setText(total_principal.getText().toString());
                    butConfTransferencia.setVisibility(View.VISIBLE);
                    consPAgoTarjetaBoton.setVisibility(View.GONE);
                    butPagoIgual        .setVisibility(View.GONE);
                }

                butTransferencia.setBackgroundDrawable(d);
                butTransferencia.setTextColor(color);
                adap_nom_id_jsonventa.actualizar();
            }
        } else if (R.id.button144 == id) {
            /**   PAGO DIVIDIDO   **/
            if (adapRegVenta.getItemCount() > 0) {
                selecPago(pagoDividido);
                if (estadoSelec(pagoDividido)) {
                    try {
                        if (!jsonVenta_actual.has(datosPagoDividido) || !jsonVenta_actual.has(escalon_pago_div)) {
                            jsonVenta_actual.put(movimiento, pagoEfectivo);
                            d = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
                            color = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);
                            if (jsonVenta_actual.has(pagoDividido)) {
                                /** SI NO ESTA LA VAR ESCALON, ENTONCES NO SE A CONCRETADO NINGUN PAGO **/
                                if (!jsonVenta_actual.has(escalon_pago_div)) {
                                    switch (jsonVenta_actual.getString(pagoDividido)) {
                                        case "pagoTransferencia":
                                            cons_info_trans.setVisibility(View.GONE);
                                            montoPago.setEnabled(true);
                                            butTransferencia.setBackgroundDrawable(d);
                                            butTransferencia.setTextColor(color);
                                            consPagoDividido_abajo.setVisibility(View.GONE);
                                            butConfTransferencia.setVisibility(View.GONE);
                                            consPagoDividido_abajo.setVisibility(View.GONE);

                                            consPAgoTarjetaBoton.setVisibility(View.VISIBLE);
                                            butPagoIgual.setVisibility(View.VISIBLE);

                                            jsonVenta_actual.remove(pagoDividido);
                                            jsonVenta_actual.remove(datosPagoDividido);
                                            break;
                                        case "pagoTarjeta":
                                            consPAgoTarjetaBoton.setVisibility(View.VISIBLE);
                                            pagarConTarjeta_cambioPago.setVisibility(View.GONE);
                                            butPagoIgual.setVisibility(View.VISIBLE);
                                            butTransferencia.setVisibility(View.VISIBLE);
                                            butMasUnaVenta.setVisibility(View.VISIBLE);
                                            consPagoDividido_abajo.setVisibility(View.GONE);
                                            consPagoConTarjeta.setVisibility(View.GONE);

                                            jsonVenta_actual.remove(pagoDividido);
                                            jsonVenta_actual.remove(datosPagoDividido);
                                            break;
                                    }
                                }
                            }
                            jsonVenta_actual.remove(movimiento);
                        } else {
                            popPagoTrans_NoConcretada popPagoTransNoConcretada = new popPagoTrans_NoConcretada();
                            popPagoTransNoConcretada.showPopupWindow(v, this);
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                } else {
                    try {
                        jsonVenta_actual.put(movimiento, pagoDividido);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    d = getResources().getDrawable(R.drawable.medio_red_morado);
                    color = ContextCompat.getColor(getApplicationContext(), R.color.blanco);
                }
                if (d != null) {
                    butPagoDividido.setBackgroundDrawable(d);
                    butPagoDividido.setTextColor(color);
                }
                adap_nom_id_jsonventa.actualizar();
            }
        } else if (R.id.button123 == id) {
            /** PAGO TARJETA**/
            if (!jsonVenta_actual.has(pagoDividido)) {
                selecPago(pagoTarjeta);
                if (adapRegVenta.getItemCount() > 0) {
                    ConstraintLayout consPAgoTarjetaBoton = (ConstraintLayout) findViewById(R.id.consPAgoTarjetaBoton);
                    TextView textView = (TextView) findViewById(R.id.textView397);

                    if (estadoSelec(pagoTarjeta)) {
                        if(comisionTarjeta()){
                            consPagoConTarjeta.setVisibility(View.GONE);
                            txt_comicion_tarjeta.setText("");
                            txt_total_tarjeta.setText("");
                            montoPago.setText("");
                            montoPago.setEnabled(true);
                            butConfTransferencia.setVisibility(View.GONE);
                        }
                        d = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
                        color = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);
                        jsonVenta_actual.remove(movimiento);
                        butConfTransferencia.setVisibility(View.GONE);
                        butTransferencia    .setVisibility(View.VISIBLE);
                        butPagoIgual        .setVisibility(View.VISIBLE);
                        montoPago  .setEnabled(true);
                        but_cobrar .setEnabled(true);
                    } else {
                        butConfTransferencia.setVisibility(View.VISIBLE);
                        montoPago  .setEnabled(false);
                        but_cobrar .setEnabled(false);
                        if(comisionTarjeta()){
                            consPagoConTarjeta  .setVisibility(View.VISIBLE);
                            int comicion = Math.round(Float.parseFloat(total_principal.getText().toString()) * 0.04f);
                            txt_comicion_tarjeta.setText(String.valueOf(comicion));
                            txt_total_tarjeta.setText(String.valueOf(Integer.parseInt(total_principal.getText().toString()) + comicion));
                            montoPago.setText(String.valueOf(Integer.parseInt(total_principal.getText().toString()) + comicion));
                        }else {
                            montoPago.setText(String.valueOf(Integer.parseInt(total_principal.getText().toString())));
                        }
                        butTransferencia    .setVisibility(View.GONE);
                        butPagoIgual        .setVisibility(View.GONE);
                        montoPago.setEnabled(false);
                        d = getResources().getDrawable(R.drawable.medio_red_morado);
                        color = ContextCompat.getColor(getApplicationContext(), R.color.blanco);
                        try {
                            jsonVenta_actual.put(movimiento, pagoTarjeta);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                    consPAgoTarjetaBoton.setBackgroundDrawable(d);
                    textView.setTextColor(color);
                    adap_nom_id_jsonventa.actualizar();
                }
            } else {
                t("paso");
            }
        } else if (R.id.butLimpAutoCompApId == id) {
            autoComplete_codigoArt.setText("");
        } else if (R.id.cobrar == id) {

      /*
            try {
                fire.documenRef(getString(R.string.ventas_n) + "/" + "2024").
                        set(new Gson().fromJson(
                                objectFechasVenta.getJSONObject("2024").toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                            @Override
                            public void onSuccess(Void unused) {
                                toast("ok", getApplicationContext());
                            }
                        });
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

       */
            /** COBRAR **/


            if (selectedDevice_static==null) {
              browseBluetoothDevice();
            } else {

                String opc = "";
                if (adapRegVenta.getItemCount() > 0) {
                    if (!jsonVenta_actual.has(movimiento)) {
                        try {
                            jsonVenta_actual.put(movimiento, pagoEfectivo);
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        opc = "0";
                    } else {
                        try {
                            String mov = jsonVenta_actual.getString(movimiento);
                            if (mov.equals(pagoTarjeta)) {
                                // - 1 PAGO DESIGNADO TARJETA
                                opc = "0";
                            } else if (mov.equals(pagoTransferencia)) {
                                // - 1 PAGO DESIGNADO TRANSFERENCIA
                                ///----------
                            } else if (mov.equals(pagoDividido)) {
                                opc = "1";
                                if (jsonVenta_actual.has(pagoDividido)) {
                                    // - 2 FORMA PAGO CAMBIADA
                                    // EXISTE CUANDO YA SE CONCRETO UN PAGO
                                    if (jsonVenta_actual.has(cambioFormaPago_string)) {
                                        if (jsonVenta_actual.getString(cambioFormaPago_string).equals(pagoTransferencia)) {
                                            //POP PRECIONAR CONFIRMAR TRANSFERENCIA
                                            opc = "2";
                                        } else {
                                            opc = "0";
                                        }
                                    } else {
                                        if (jsonVenta_actual.getString(pagoDividido).equals(pagoTransferencia)) {
                                            if (jsonVenta_actual.has(datosPagoDividido)) {
                                                opc = "0";
                                            } else {
                                                opc = "2";
                                            }
                                        } else {
                                            opc = "0";
                                        }
                                    }

                                }
                            } else if (mov.equals(pagoEfectivo)) {
                                opc = "0";
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                }
                switch (opc) {
                    case "0":
                        if (montoPago.length() > 0) {
                            llenar_datos_venta();
                            ticketDigital ticketDigital = new ticketDigital();
                            boolean statusSinTicket = false;
                            if (((Button)findViewById(R.id.button40)).getVisibility() == View.VISIBLE)statusSinTicket = true;
                            ticketDigital.showPopupWindow(v, principal.this, statusSinTicket);
                        }
                        break;
                    case "1":
                        popPagoDividido popPagoDividido = new popPagoDividido();
                        popPagoDividido.showPopupWindow(v, this, total_principal.getText().toString());
                        break;
                    case "2":
                        t("PRECIONE CONFIRMAR TRANSFERENCIA");
                        break;
                }
            }
        } else if (R.id.button5 == id) {
            RecyclerView recyclerView = (RecyclerView) findViewById(R.id.recyclerView_equipoTrabajo);
            if (recyclerView.getVisibility() == View.VISIBLE) {
                recyclerView.setVisibility(View.GONE);
            } else {
                recyclerView.setVisibility(View.VISIBLE);
            }
        } else if (R.id.button8 == id) {
            /** BUT CONFIRMAR TRANSFERENCIA **/
            d = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
            color = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);
            cons_info_trans.setVisibility(View.GONE);
            butTransferencia.setBackgroundDrawable(d);
            butTransferencia.setTextColor(color);

            try {
                if (jsonVenta_actual.has(datosPagoDividido)) {
                    if (jsonVenta_actual.has(cambioFormaPago_string)) {
                        confirmar_pago_cambio_a_trans
                                pop_confPagCambA_trans = new confirmar_pago_cambio_a_trans();
                        pop_confPagCambA_trans.showPopupWindow(v, this);
                    } else {
                        jsonVenta_actual.put(escalon_pago_div, "1");
                        butMasUnaVenta.setVisibility(View.GONE);
                        butTransferencia.setVisibility(View.GONE);
                        butcambiarFormaDePago.setVisibility(View.VISIBLE);
                        palomaPagoDiv.setVisibility(View.VISIBLE);
                        butConfTransferencia.setVisibility(View.GONE);
                        jsonVenta_actual.put("trans_dividido_hora", DateFormat.getDateTimeInstance().format(new Date()));
                        switch (jsonVenta_actual.getJSONObject(datosPagoDividido).getString("mov")) {
                            case "TRANSFERENCIA-EFECTIVO":
                                break;
                            case "TRANSFERENCIA-TARJETA":
                                butcambiarFormaDePago.setVisibility(View.VISIBLE);

                                consPagoConTarjeta.setVisibility(View.VISIBLE);
                                txt_comicion_tarjeta.setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("comision"));
                                txt_total_tarjeta.setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("totalConComision"));

                                montoPago.setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("totalConComision"));
                                break;
                        }
                    }
                } else {
                    //imp_TicketTrans_norm.setVisibility(View.VISIBLE);
                    consPAgoTarjetaBoton.setVisibility(View.GONE);
                    butMasUnaVenta.setVisibility(View.GONE);
                    butPagoIgual.setVisibility(View.GONE);
                    butTransferencia.setVisibility(View.GONE);
                    butPagoDividido.setVisibility(View.GONE);
                    butConfTransferencia.setVisibility(View.GONE);
                    if (jsonVenta_actual.getString(movimiento).equals(pagoTransferencia)) {
                        jsonVenta_actual.put("trans_normal_hora", DateFormat.getDateTimeInstance().format(new Date()));
                    }else if (jsonVenta_actual.getString(movimiento).equals(pagoTarjeta)) {
                        jsonVenta_actual.put("tarjeta_normal_hora", DateFormat.getDateTimeInstance().format(new Date()));
                    }
                    llenar_datos_venta();
                    finalizarVenta(false);
                }

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            adap_nom_id_jsonventa.actualizar();
        } else if (R.id.but_iniciarSesionClip_sliding == id) {
            if (jsonDatos.length() > 0){
                if(!loadData_sharedPreferences(getApplicationContext(), getString(R.string.sesionClip), getString(R.string.sesionClip)).equals("")){
                    JSONObject objClip = null;
                    try {
                        objClip = new JSONObject(loadData_sharedPreferences(getApplicationContext(), getString(R.string.sesionClip), getString(R.string.sesionClip)));
                        if(isValidEmail(objClip.getString("correo"))){
                            /*
                            ClipApi.login(objClip.getString("correo"), objClip.getString("pass"), new LoginListener() {
                                @Override
                                public void onLoginSuccess() {
                                    LayoutInflater inflater = getLayoutInflater();
                                    View layout = inflater.inflate(R.layout.toast_naranja, findViewById(R.id.layout_base1)); // Asegúrate de tener un contenedor en tu actividad
                                    generales.toastNaranja("SESCION INICIADA", getApplicationContext(),layout, 2);
                                }
                                @Override
                                public void onLoginFailed(@NotNull StatusCode.ClipError clipError) {
                                    toast("PROBLEMA AL INICIAR SECION", getApplicationContext());
                                }
                            });
                             */
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }else toast("NO HAY CUENTA REGISTRADA", getApplicationContext());
            }
        } else if (R.id.button13 == id) {
            popcambio_forma_pago_dividido popCFP = new popcambio_forma_pago_dividido();
            try {
                popCFP.showPopupWindow(v, jsonVenta_actual.getJSONObject(datosPagoDividido).getString("mov"), this);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        } else if (R.id.butCancelarVenta == id) {
            if(adapRegVenta.getItemCount() > 0)adapRegVenta.vaciar();
            reset();
        } else if (R.id.button118 == id) {
            if(total_principal.length() > 0)montoPago.setText(total_principal.getText().toString());
        } else if (R.id.producto_noRegistrado == id) {
            popArtNoRegistrado popArtNoRegistrado = new popArtNoRegistrado();
            popArtNoRegistrado.showPopupWindow(v, adapRegVenta,  (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE));
        } else if (R.id.button40 == id){
            ((Button)findViewById(R.id.button40)).setVisibility(View.GONE);
        } else if (R.id.button42_barcode_generator == id) {
            pop.pop_barcode_imprimir popBarcodeImprimir = new pop_barcode_imprimir();
            popBarcodeImprimir.showPopupWindow(v, this);
        }
    }
    private static final String ACTION_USB_PERMISSION = "com.example.tsplprinter.USB_PERMISSION";
    private UsbManager usbManager = null;
    private UsbDeviceConnection usbConnection;

    public void sendCodigo_registrado(String price, String barcode, String cantidad){

        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);

        printLabel_registrado(price, barcode, Integer.parseInt(cantidad));
    }

    public void sendCodigo_no_reg(String price, String cantidad){

        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);

        printLabel_no_registrado(price, Integer.parseInt(cantidad));
    }
    public void printLabel_no_registrado(String price, int quantity) {

        // Construye la cadena TSPL
        String tsplCommand = buildTsplCommand_no_registrado(price, quantity);

        // Buscar el dispositivo USB
        selectUsbDevice(tsplCommand);
    }
    public void printLabel_registrado(String price, String code, int quantity) {

        // Validación rápida del código de barras (8 dígitos)
        if (code == null || !code.matches("\\d{8}")) {
            Toast.makeText(this, "El código debe tener 8 dígitos", Toast.LENGTH_SHORT).show();
            return;
        }
        // Construye la cadena TSPL
        String tsplCommand = buildTsplCommand_registrado(price, code, quantity);

        // Buscar el dispositivo USB
        selectUsbDevice(tsplCommand);
    }

    private void selectUsbDevice(String tsplCommand) {
        usbConnection = usbManager.openDevice(currentUsbDevice);
        if (usbConnection != null) {
            t( "Conexión USB abierta. Enviando TSPL...");
            sendTspl(usbConnection, currentUsbDevice, tsplCommand);
        } else {
            t("No se pudo abrir la conexión USB");
        }
    }


    /**
     * Construye la cadena TSPL con los parámetros solicitados.
     */
    private String buildTsplCommand_registrado(String price, String barcode, int quantity) {
        StringBuilder sb = new StringBuilder();
        sb.append("SIZE 29 mm, 14 mm\n");
        sb.append("GAP 3 mm, 0 mm\n");
        sb.append("DENSITY 8\n");
        sb.append("SPEED 4\n");
        sb.append("DIRECTION 0\n");
        sb.append("REFERENCE 0,0\n");

        // -- Agregamos estos dos comandos --
        sb.append("SET TEAR ON\n");        // Activa el modo de corte manual
        sb.append("SET TEAR ADJUST 5\n"); // Ajusta (en mm). Puedes probar 5, 8, etc.

        sb.append("CLS\n");

        // Precio
        sb.append("TEXT 85,10,\"1\",0,2,2,\"$").append(price).append("\"\n");
        // Código de barras
        sb.append("BARCODE 40,35,\"128\",30,0,0,2,3,\"").append(barcode).append("\"\n");
        // Número debajo
        sb.append("TEXT 40,70,\"1\",0,2,2,\"").append(barcode).append("\"\n");

        // Cantidad de etiquetas
        sb.append("PRINT ").append(quantity).append("\n");

        return sb.toString();
    }
    private String buildTsplCommand_no_registrado(String price, int quantity) {
        StringBuilder sb = new StringBuilder();
        sb.append("SIZE 29 mm, 14 mm\n");
        sb.append("GAP 3 mm, 0 mm\n");
        sb.append("DENSITY 8\n");
        sb.append("SPEED 4\n");
        sb.append("DIRECTION 0\n");
        sb.append("REFERENCE 0,0\n");

        // -- Agregamos estos dos comandos --
        sb.append("SET TEAR ON\n");        // Activa el modo de corte manual
        sb.append("SET TEAR ADJUST 5\n"); // Ajusta (en mm). Puedes probar 5, 8, etc.

        sb.append("CLS\n");

        // Precio
        sb.append("TEXT 85,10,\"1\",0,2,2,\"").append("NO REGISTRADO").append("\"\n");
        // Número debajo
        sb.append("TEXT 40,70,\"1\",0,2,2,\"$").append(price).append("\"\n");

        // Cantidad de etiquetas
        sb.append("PRINT ").append(quantity).append("\n");

        return sb.toString();
    }


    /**
     * Busca un dispositivo USB con el VendorId y ProductId dados.
     */
    private UsbDevice findDevice(int vendorId, int productId) {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        for (UsbDevice device : deviceList.values()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                return device;
            }
        }
        return null;
    }


    // Variable para guardar temporalmente el comando TSPL mientras esperamos el permiso
    private String pendingTsplCommand = null;

    /**
     * BroadcastReceiver para recibir la respuesta de permiso USB.
     */

    /**
     * Envía la cadena TSPL usando bulkTransfer con un endpoint Bulk OUT.
     */
    private void sendTspl(UsbDeviceConnection connection, UsbDevice device, String tsplCommand) {
        if (tsplCommand == null) {
            t("tsplCommand es null");
            return;
        }
        try {
            // Reclama la interfaz
            UsbInterface usbInterface = device.getInterface(0);
            connection.claimInterface(usbInterface, true);

            // Buscar endpoint de tipo Bulk y dirección OUT
            UsbEndpoint endpointOut = null;
            for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
                UsbEndpoint ep = usbInterface.getEndpoint(i);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                        ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    endpointOut = ep;
                    break;
                }
            }
            if (endpointOut == null) {
                t("No se encontró endpoint Bulk OUT en la interfaz.");
                return;
            }

            // Convertir el comando a bytes ASCII
            byte[] buffer = tsplCommand.getBytes(StandardCharsets.US_ASCII);

            // Enviar con bulkTransfer
            int result = connection.bulkTransfer(endpointOut, buffer, buffer.length, 2000);
            if (result < 0) {
                t("Error al enviar bulkTransfer: " + result);
            } else {
                t("Enviados " + result + " bytes:\n" + tsplCommand);
                t( "Impresión enviada");
            }
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(this, "Error al enviar TSPL: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }



























    public void actualizarTodosFinish(){
        ((ConstraintLayout)findViewById(R.id.consProgresBar_var_mod)).setVisibility(View.GONE);
    }

    private androidx.biometric.BiometricPrompt getBiometricPrompt(View v, String enturno, Executor executor) {
        String finalEnturno = enturno;
        androidx.biometric.BiometricPrompt
                biometricPrompt = new androidx.biometric.BiometricPrompt(principal.this, executor, new androidx.biometric.BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                pop_administrador_contraseña popAdmin = new pop_administrador_contraseña();
                popAdmin.showPopupWindow(v, finalEnturno, principal.this);
            }

            @Override
            public void onAuthenticationSucceeded(@NonNull androidx.biometric.BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                initClasAdmin();
            }

            @Override
            public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
            }
        });
        return biometricPrompt;
    }

    @Override
    public void onClick(View v) {
        int u = v.getId();
        but_switch(u, v);
    }

    public void finalizarVenta(boolean bool_darTicket){
        escucharventabol = false;
        huella_venta_registro = editar_articulos.generarID();
        pop.ventaRealizada ventaRealizada = new ventaRealizada();
        ventaRealizada.showPopupWindow(getWindow().getDecorView());
        ejecutar_ventaRealizada_uno(ventaRealizada);
        try {
            if(jsonVenta_actual.has(numeroDeVenta)){

                String año      = jsonVenta_actual.getString(id_registro).split(" ")[0];
                String mes      = jsonVenta_actual.getString(id_registro).split(" ")[1];
                String dia      = jsonVenta_actual.getString(id_registro).split(" ")[2];


                String añoActual = getAnñoMesDiaHora("año");
                String mesActual = quitarCero(getAnñoMesDiaHora("mes"));
                String diaActual = quitarCero(getAnñoMesDiaHora("dia"));
                jsonVenta_actual.put("huella", huella_venta_registro);

                /**subir venta**/
                String numeroDeVenta = new modulos_carga.subir_documento_sobre_fechas().init(
                        jsonVenta,
                        jsonVenta_actual,
                        añoActual,
                        mesActual,
                        diaActual,
                        getApplicationContext(),
                        "jsonVenta"
                );

                if(numeroDeVenta != null){

                    /**apartados**/
                    new venta.apartados().init(objDatosApartado, objDatosCliente, adapRegVenta, getApplicationContext());

                    /**venta por a rticulos**/
                    new venta.ventaPorArticulo().init(getApplicationContext(), new JSONArray(adapRegVenta.getArray().toString()), numeroDeVenta, año, mes, dia);

                    /**corte**/
                    new venta.corte().init(getApplicationContext(), añoActual, mesActual, diaActual, numeroDeVenta);

                    /**actualizar fechas de venta**/
                    new venta.actualizarFechas().init(añoActual, mesActual, diaActual, objectFechasVenta, "jsonVenta", getApplicationContext());

                }

                actualizarDatosGuardados("objectFechasVenta"    , objectFechasVenta.toString()  , getApplicationContext());
                actualizarDatosGuardados("jsonArticulos"        , jsonArticulos.toString()      , getApplicationContext());
                actualizarDatosGuardados("jsonVenta"            , jsonVenta.toString()          , getApplicationContext());
                actualizarDatosGuardados("jsonVentaXarticulo"   , jsonVentaXarticulo.toString() , getApplicationContext());
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        if(bool_darTicket){
            adapRegVenta.vaciar();
            reset();
        }else {
            if (darTicket())imprimirTikcet();
            else {
                adapRegVenta.vaciar();
                reset();
            }
        }

    }

    public CollectionReference refCollection(String refCollection){
        return fire.colRef(refCollection);
    }
    boolean escucharventabol = false;
    boolean escucharTokenArticulo_n = false;
    JSONArray arrayIDArt = new JSONArray();

    private void descargarArtActualizacion(){
        DocumentReference docRef = null;
        try {
            docRef = refCollection( "articulos_n/").document(arrayIDArt.getString(arrayIDArt.length()-1));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        docRef.get().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                DocumentSnapshot document = task.getResult();
                if (document.exists()) {
                    Map<String, Object> data = document.getData();
                    JSONObject object = new JSONObject(data);
                    try {
                        jsonArticulos.put(object.getString("id"), object);
                        actualizarDatosGuardados("jsonArticulos", jsonArticulos.toString(), getApplicationContext());
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    arrayIDArt.remove(arrayIDArt.length()-1);
                    if(arrayIDArt.length()!=0){
                        descargarArtActualizacion();
                    }else {
                        toast("TOKEN ARTICULOS", getApplicationContext());
                        JSONObject objReset = new JSONObject();
                        try {
                            objReset.put("vacio", "");
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        fire.documenRef("datos/" + "articulosToken_n").
                                set(new Gson().fromJson(
                                        objReset.toString(), HashMap.class));
                        escucharTokenArticulo_n = false;
                    }
                } else {

                }
            } else {

            }
        });
    }

    boolean escucharTokenBasePeronaje = false;
    public void escucharCambiosBasePersonajes(){
        DocumentReference docRef = refCollection( "datos/").document("personajesToken");
        docRef.addSnapshotListener(
                new EventListener<DocumentSnapshot>() {
                    @Override
                    public void onEvent(@Nullable DocumentSnapshot documentSnapshot, @Nullable FirebaseFirestoreException e) {
                        if (e != null) {
                            toast("documento vacio", getApplicationContext());
                            return;
                        }
                        if(escucharTokenBasePeronaje){
                            if (documentSnapshot != null && documentSnapshot.exists()) {
                                try {
                                    JSONObject object = mapToJSON(Objects.requireNonNull(documentSnapshot.getData()));
                                    JSONArray array = new JSONArray();
                                    String mov = "";
                                    if (!object.has("generales")){
                                        array = object.getJSONArray("generales");
                                        for (int i = 0; i < array.length(); i++){
                                            JSONObject objectdatos = array.getJSONObject(i);
                                            jsonNamPersonajes.put(objectdatos.getString("codigo"), objectdatos.getString("nombre"));
                                        }
                                        mov = "GENERALES";
                                    } else if (!object.has("funkos")){
                                        array = object.getJSONArray("funkos");
                                        for (int i = 0; i < array.length(); i++){
                                            JSONObject objectdatos = array.getJSONObject(i);
                                            jsonNamFunkos.put(objectdatos.getString("codigo"), objectdatos.getString("nombre"));
                                        }
                                        mov = "FUNKOS";
                                    }
                                    toast("TOKEN PERSONAJES" + " " + mov, getApplicationContext());
                                    JSONObject objReset = new JSONObject();
                                    fire.documenRef("datos/" + "personajesToken").
                                            set(new Gson().fromJson(
                                                    objReset.toString(), HashMap.class));
                                    escucharTokenBasePeronaje = false;
                                } catch (JSONException ex) {
                                    throw new RuntimeException(ex);
                                }

                            } else {
                                toast("Current data: null 123", getApplicationContext());
                            }
                        }else escucharTokenBasePeronaje = true;
                    }
                });
    }
    public JSONObject mapToJSON(Map<String, Object> map) throws JSONException {
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

    private JSONArray listToJSONArray(List<Object> list) throws JSONException {
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
    public double tamañoJSONObject(JSONObject object) {
        try {
            // Crear un JSONObject de ejemplo
            // Convertir el JSONObject a cadena de texto
            String jsonText = object.toString();
            // Obtener los bytes de la cadena en UTF-8
            byte[] jsonBytes = jsonText.getBytes("UTF-8");
            // Calcular el tamaño en megabytes
            double sizeInMegabytes = jsonBytes.length / (1024.0 * 1024.0);
            // Imprimir el tamaño
            return sizeInMegabytes;
        } catch (Exception e) {
            e.printStackTrace();
            return 0f;
        }
    }
    private void llenar_datos_venta(){
        Calendar c = Calendar.getInstance();
        c.set(c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)); // vairables int

        String añoActual = getAnñoMesDiaHora("año");
        String mesActual = quitarCero(getAnñoMesDiaHora("mes"));
        String diaActual = quitarCero(getAnñoMesDiaHora("dia"));

        if(adapRegVenta.getItemCount() > 0){
            try {
                jsonVenta_actual.put("articulos", adapRegVenta.getArray());

                jsonVenta_actual.put("enTurno"  , enTurno.getText().toString());

                if(jsonVenta_actual.getString(movimiento).equals(pagoTarjeta)){//txt_comicion_tarjeta
                    if(comisionTarjeta()){
                        jsonVenta_actual.put("total_pago_tarjeta"       , txt_total_tarjeta.getText().toString());
                        jsonVenta_actual.put("comicion"                 , txt_comicion_tarjeta.getText().toString());
                        jsonVenta_actual.put("statusComision","con comision");
                    } else {
                        jsonVenta_actual.put("total_pago_tarjeta"       , total_principal.getText().toString());
                        jsonVenta_actual.put("comicion"                 , "0");
                        jsonVenta_actual.put("statusComision","sin comision");
                    }
                }
                jsonVenta_actual.put("montoCobro"   , total_principal.getText().toString());
                jsonVenta_actual.put("montoPago"    , montoPago.getText().toString());
                jsonVenta_actual.put("fecha"        , DateFormat.getDateTimeInstance().format(new Date()));
                jsonVenta_actual.put("dia"          , generales.diasIngEsp(c.get(Calendar.DAY_OF_WEEK)));


                jsonVenta_actual.put("ultimo_dia_registrado_en_venta", diaActual);

                String numeroDeVentaAsignado = "", idVenta;
                if (jsonVenta.length() > 0){
                    boolean u = false;
                    if(jsonVenta.has(añoActual)){
                        if (jsonVenta.getJSONObject(añoActual).has(mesActual)){
                            if(jsonVenta.getJSONObject(añoActual).getJSONObject(mesActual).has(diaActual)){
                                numeroDeVentaAsignado =
                                        String.valueOf(
                                                jsonVenta.
                                                        getJSONObject(añoActual).
                                                        getJSONObject(mesActual).
                                                        getJSONObject(diaActual).getJSONArray("registro").length());
                            }else u = false;
                        }else u = false;
                    }else u = false;
                    if(!u){
                        numeroDeVentaAsignado = String.valueOf(Integer.parseInt(idUltimaVenta));
                    }
                }else {
                    numeroDeVentaAsignado = String.valueOf(Integer.parseInt(idUltimaVenta));
                }

                idVenta = añoActual + " " + mesActual + " " + diaActual + " " + numeroDeVentaAsignado;


                jsonVenta_actual.put(numeroDeVenta, numeroDeVentaAsignado);
                jsonVenta_actual.put("idVenta", idVenta);
                //t("ultimo dia reg: " + dia + "  " + "id_venta: " + idVenta_nueva);
                String año_      = getAnñoMesDiaHora("año");
                String mes_      = quitarCero(getAnñoMesDiaHora("mes"));
                String dia_      = quitarCero(getAnñoMesDiaHora("dia"));

                jsonVenta_actual.put(id_registro,
                        año_        + " " +
                                mes_      + " " +
                                dia_);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            adap_nom_id_jsonventa.actualizar();
        }
    }

    public void imprimirTikcet(){
        pagoTarjeta.uno pagoTarjeta = new pagoTarjeta.uno();
        try {
            pagoTarjeta.printBluetooth(principal.this, new JSONArray(adapRegVenta.getArray().toString()), new JSONObject(jsonVenta_actual.toString()), getApplicationContext());
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        adapRegVenta.vaciar();
        reset();
    }
    private void ejecutar_ventaRealizada_uno(pop.ventaRealizada ventaRealizada){
        final Handler handler= new Handler();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                //handler.postDelayed(this,1000);//se ejecutara cada 10 segundose
                ventaRealizada.fadeOut();
                ejecutar_ventaRealizada_dos(ventaRealizada);
            }
        },3000);//empezara a ejecutarse después de 2 segundos
    }
    private void ejecutar_ventaRealizada_dos(pop.ventaRealizada ventaRealizada){
        final Handler handler= new Handler();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                //handler.postDelayed(this,1000);//se ejecutara cada 10 segundose
                ventaRealizada.off();
            }
        },1000);//empezara a ejecutarse después de 2 segundos
    }
    private boolean estadoSelec(String direccion){
        boolean estado = false;
        if(jsonVenta_actual.has(movimiento)){
            try {
                if(jsonVenta_actual.getString(movimiento).equals(direccion)){
                    estado = true;
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        return estado;
    }
    String numeroDeVenta = "numeroDeVenta", id_registro = "id_registro";
    private String quitarCero(String s){
        if(s.charAt(0) == '0')s = Character.toString(s.charAt(1));
        return s;
    }
    private String getAnñoMesDiaHora(String get){
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        simpleDateFormat.setTimeZone(myTimeZone);
        String dateTime = simpleDateFormat.format(new Date());
        //                                2020-08-20 16:40:34
        if(get.equals("año")){return (dateTime.split(" ")[0]).split("-")[0];}
        else if (get.equals("mes")){return (dateTime.split(" ")[0]).split("-")[1];}
        else if (get.equals("dia")){return (dateTime.split(" ")[0]).split("-")[2];}
        else if (get.equals("hora")){return (dateTime.split(" ")[1]);}
        return "null";
    }
    private static final int REQUEST_PAY_Normal     = 1234;
    private static final int REQUEST_PAY_Dividido_efec_tar   = 0153;
    private static final int REQUEST_PAY_Dividido_trans_tar   = 1703;
    public void pagoTarjeta(String monto, String selecOperacion){
        String operador = "mercadopago";
        if (operador.equals("mercadopago")){
            ((Button)findViewById(R.id.button8)).setVisibility(View.VISIBLE);
        }else if (operador.equals("clip")){
            //BigDecimal bigDecimal = new BigDecimal(monto + ".0");
       /*
        ClipPayment clipPayment = new ClipPayment.Builder().
                amount(bigDecimal).
                enableContactless(true).
                build();
        */
            //int i = 0;
            //i = REQUEST_PAY_Normal;
            //if(selecOperacion.equals(pagoTarjeta))
        /*
        else if(selecOperacion.equals(pagoDividido))i = REQUEST_PAY_Dividido_efec_tar;
        else if (selecOperacion.equals(getPagoDividido_trans_tar)) {i = REQUEST_PAY_Dividido_trans_tar;}
         */
            //ClipApi.launchPaymentActivity(this, clipPayment, i);
        }

    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {

        if (requestCode == pop.pop_mensajes.REQUEST_PICK_IMAGE && resultCode == RESULT_OK && data != null) {
            if (pop_mensajes != null && pop_mensajes.estadoPop()) {
                pop_mensajes.onMediaResult(data.getData());
            }
            return;
        }

        switch (requestCode) {

            case REQUEST_PAY_Dividido_trans_tar:
                assert data != null;
                // StatusCode.RESULT_CODE, StatusCode.FAILURE
                switch (data.getIntExtra("0", 1)) {
                   /*
                    case StatusCode.SUCCESSFUL:

                        break;
                    case StatusCode.FAILURE:
                        butcambiarFormaDePago   .setVisibility(View.GONE);
                        consPagoDividido_abajo  .setVisibility(View.GONE);

                        butTransferencia    .setVisibility(View.VISIBLE);
                        consPAgoTarjetaBoton.setVisibility(View.VISIBLE);
                        butPagoIgual        .setVisibility(View.VISIBLE);
                        butMasUnaVenta      .setVisibility(View.VISIBLE);

                        montoPago.setText("");

                        Drawable d; int color;
                        d       = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
                        color   = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);
                        butPagoDividido.setBackgroundDrawable(d);
                        butPagoDividido.setTextColor(color);

                        jsonVenta_actual = new JSONObject();

                        break;
                    */
                }
                break;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    public void pagoDividido_pop(String movimiento, String cantidad, String mov, String tituloPrimerPago){
        com.example.nodo_1.pagoDividido pagoDividido_clas = new pagoDividido();
        pagoDividido_clas.pop_pagoDividido(
                getApplicationContext(),
                pagarConTarjeta_cambioPago,
                consPagoConTarjeta,
                consPagoDividido_abajo,
                consPAgoTarjetaBoton,
                cons_info_trans,
                jsonVenta_actual,
                total_principal,
                txtRestaPagoDiv,
                ((TextView) findViewById(R.id.textViewGranTotal10)), //restaPagoDividivido
                texPagoDiv,
                txt_comicion_tarjeta,
                txt_total_tarjeta,
                texto_resta_pagoDiv,
                montoPago,
                butMasUnaVenta,
                butTransferencia,
                butPagoIgual,
                butConfTransferencia,
                datosPagoDividido
                ,movimiento, cantidad, mov, tituloPrimerPago);
    }
    public static String cambioFormaPago_string = "cambioFormaPago";
    public static String datos_cambioFormaPago  = "datos_cambioFormaPago";
    public void cambiarFormaPago(String formaPago, String operacion){
        com.example.nodo_1.pagoDividido pagoDividido_clas = new pagoDividido();
        pagoDividido_clas.cambiarFormaPago(
                consCambioFormaPago,
                consCambioPago_Trans,
                consCambioPago_Tarjeta,
                cambioPAgo_Titulo,
                cambioPago_trans,
                cambioPago_tarjeta_comision,
                cambioPago_Tarjeta_GranTotal,
                formaPago,
                operacion,
                adap_nom_id_jsonventa
        );
    }
    public void consPago_cambio_a_trans(){
        reset();

        try {
            jsonVenta_actual.put("trans_cambioTipoPago_hora", DateFormat.getDateTimeInstance().format(new Date()));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        pop.ventaRealizada ventaRealizada = new ventaRealizada();
        ventaRealizada.showPopupWindow(getWindow().getDecorView());
        ejecutar_ventaRealizada_uno(ventaRealizada);

    }
    public void infoPago_trans(){
        if(jsonDatos.length()>0){
            if(jsonDatos.has(getString(R.string.transferencia_datos))){
                try {
                    JSONObject obj       = jsonDatos.getJSONObject(getString(R.string.transferencia_datos));
                    TextView banco       = (TextView) findViewById(R.id.textView8);
                    TextView tarjeta     = (TextView) findViewById(R.id.textView4);
                    TextView referencia  = (TextView) findViewById(R.id.textView7);
                    TextView titular     = (TextView) findViewById(R.id.textView9);
                    banco       .setText(obj.getString("banco"));
                    tarjeta     .setText(obj.getString("tarjeta"));
                    referencia  .setText(obj.getString("referencia"));
                    titular     .setText(obj.getString("titular"));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    }
    private void reset(){
        objDatosApartado = new JSONObject();
        objDatosCliente  = new JSONObject();
        butConfTransferencia        .setVisibility(View.GONE);
        consCambioFormaPago         .setVisibility(View.GONE);
        butcambiarFormaDePago       .setVisibility(View.GONE);
        consCambioPago_Trans        .setVisibility(View.GONE);
        consCambioPago_Tarjeta      .setVisibility(View.GONE);
        if(mostrarBotonPagoTarjeta())consPAgoTarjetaBoton.setVisibility(View.VISIBLE);
        if(mostrarBotonTransferencia())butTransferencia  .setVisibility(View.VISIBLE);
        butPagoIgual                .setVisibility(View.VISIBLE);
        //butMasUnaVenta              .setVisibility(View.VISIBLE);
        cons_info_trans             .setVisibility(View.GONE);
        palomaPagoDiv               .setVisibility(View.GONE);
        cambioPago_checkTrans       .setVisibility(View.GONE);
        consPagoDividido_abajo      .setVisibility(View.GONE);
        pagarConTarjeta_cambioPago  .setVisibility(View.GONE);
        butcambiarFormaDePago       .setVisibility(View.GONE);
        Drawable d; int color;
        d       = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
        color   = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);
        butPagoDividido.setTextColor(color);
        butPagoDividido.setBackgroundDrawable(d);

        /**PAGO CON TARJETA TEXT VIEW**/
        consPAgoTarjetaBoton.setBackgroundDrawable(d);
        ((TextView)findViewById(R.id.textView397)).setTextColor(color);
        consPagoConTarjeta  .setVisibility(View.GONE);

        montoPago   .setText("");
        montoPago   .setEnabled(true);
        but_cobrar  .setEnabled(true);

        jsonVenta_actual = new JSONObject();
    }

    public void enTurnoSelec(String s){
        enTurno                     = ((TextView) findViewById(R.id.textView10));
        RecyclerView recyclerView   = (RecyclerView)findViewById(R.id.recyclerView_equipoTrabajo);
        enTurno.setText(s);
        recyclerView.setVisibility(View.GONE);
    }
    public void eliminarElementoUltimo(){
        selecPago("");
        jsonVenta_actual = new JSONObject();
        adap_nom_id_jsonventa.actualizar();
    }
    private void selecPago(String pago){
        Drawable d; int color;
        d       = getResources().getDrawable(R.drawable.cuadro_esq_red_blanco);
        color   = ContextCompat.getColor(getApplicationContext(), R.color.gris_oscuro);

        if(jsonVenta_actual.has(movimiento)){
            try {
                if((jsonVenta_actual.getString(movimiento).equals(pagoDividido)         && !pago.equals(pagoDividido))      || pago.equals("jsn")){
                    butPagoDividido.setTextColor(color);butPagoDividido.setBackgroundDrawable(d);
                    if(jsonVenta_actual.has(pagoDividido)){
                        if(jsonVenta_actual.getString(pagoDividido).equals("TRANSFERENCIA")){
                            butTransferencia        .setTextColor(color);butTransferencia .setBackgroundDrawable(d);
                            cons_info_trans         .setVisibility(View.GONE);
                            montoPago               .setEnabled(true);
                            consPagoDividido_abajo  .setVisibility(View.GONE);
                            butConfTransferencia    .setVisibility(View.GONE);
                        }
                    }
                }
                if((jsonVenta_actual.getString(movimiento).equals(pagoTarjeta)          && !pago.equals(pagoTarjeta))       || pago.equals("jsn")){
                    ConstraintLayout consPAgoTarjetaBoton = (ConstraintLayout) findViewById(R.id.consPAgoTarjetaBoton);
                    TextView         textView             = (TextView)         findViewById(R.id.textView397);
                    textView .setTextColor(color);consPAgoTarjetaBoton .setBackgroundDrawable(d);
                    consPagoConTarjeta  .setVisibility(View.GONE);
                    txt_comicion_tarjeta.setText("");
                    txt_total_tarjeta   .setText("");
                }
                if((jsonVenta_actual    .getString(movimiento).equals(pagoTransferencia) && !pago.equals(pagoTransferencia))  || pago.equals("jsn")){
                    butTransferencia    .setTextColor(color);butTransferencia .setBackgroundDrawable(d);
                    cons_info_trans     .setVisibility(View.GONE);
                    montoPago           .setEnabled(true);
                    butConfTransferencia.setVisibility(View.GONE);
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }

    public void selecItem_autoComplete_codigoArt(){
        autoComplete_codigoArt.setSingleLine();
        autoComplete_codigoArt.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if ((event.getAction() == KeyEvent.ACTION_DOWN) && (keyCode == KeyEvent.KEYCODE_ENTER)) {
                    if(autoComplete_codigoArt.length() > 0){
                        String cadena = autoComplete_codigoArt.getText().toString().trim();
                        if(cadena.contains(" ")){
                            cadena = cadena.split(" ")[0];
                        }
                        if(resolverCodigo(cadena)){
                            autoComplete_codigoArt.setText("");
                        }
                    }
                }
                return (keyCode == KeyEvent.KEYCODE_ENTER);
            }
        });
        autoComplete_codigoArt.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int i, long l) {
                if(autoComplete_codigoArt.length() > 0){
                    String cadena = autoComplete_codigoArt.getText().toString().trim();
                    if(cadena.contains(" ")){
                        cadena = cadena.split(" ")[0];
                    }
                    if(resolverCodigo(cadena)){
                        autoComplete_codigoArt.setText("");
                    }
                }
            }
        });
    }
    private boolean resolverCodigo(String cadena) {
        // 1. Código tradicional (ej: 12300001)
        if (jsonArticulos.has(cadena)) {
            pressEnterAutoCompleteID(cadena);
            return true;
        }
        // 2. Código de subvariación (ej: v-1-1)
        if (cadena.startsWith("v-")) {
            String[] partes = cadena.split("-");
            if (partes.length == 3) {
                try {
                    int artNum = Integer.parseInt(partes[1]);
                    int subvarIndex = Integer.parseInt(partes[2]);
                    String artId = String.valueOf(12300000 + artNum);
                    if (jsonArticulos.has(artId)) {
                        JSONObject art = jsonArticulos.getJSONObject(artId);
                        if (art.has("subvariaciones")) {
                            JSONArray subvars = art.getJSONArray("subvariaciones");
                            if (subvarIndex >= 1 && subvarIndex <= subvars.length()) {
                                JSONObject subvar = subvars.getJSONObject(subvarIndex - 1);
                                venta_seleccion_subvar(artId, subvar);
                                return true;
                            }
                        }
                    }
                } catch (Exception e) { e.printStackTrace(); }
            }
        }
        return false;
    }
    private void pressEnterAutoCompleteID(String cadena){
        try {
            if(jsonArticulos.getJSONObject(cadena).has("talla") || jsonArticulos.getJSONObject(cadena).has("seña")){
                pop.popVariacion_venta popVariacion_venta = new popVariacion_venta();
                popVariacion_venta.showPopupWindow(getWindow().getDecorView(), this,cadena, 0, adapRegVenta, null);
            }else venta_seleccion_(cadena, "", "", false);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void venta_seleccion_(String id, String popTalla, String popSeña, boolean igual){
        JSONObject object = new JSONObject();
        try {
            object.put("id"         , id);

            if(!popTalla.equals(""))object.put("talla"   , popTalla);
            if(!popSeña.equals(""))object.put("seña"   , popSeña);

            object.put("cantidad"   , "1");
            if(jsonArticulos.getJSONObject(id).has("descuento")){
                object.put("descuento"     , jsonArticulos.getJSONObject(id).getString("descuento"));
            } else {
                object.put("precio"        , jsonArticulos.getJSONObject(id).getString("precioVenta"));
            }
            if(jsonArticulos.getJSONObject(id).has("3x2")){
                object.put("3x2"     , "");
            }
            if(jsonArticulos.getJSONObject(id).has("mayoreo")){
                object.put("mayoreo"     , jsonArticulos.getJSONObject(id).getString("mayoreo"));
                object.put("cantMayoreo"     , jsonArticulos.getJSONObject(id).getString("cantMayoreo"));
            }
            object.put("nombrePublico"  , jsonArticulos.getJSONObject(id).getString("nombre"));
            object.put("descripcion"    , jsonArticulos.getJSONObject(id).getString("referencia"));
            object.put("precio"         , jsonArticulos.getJSONObject(id).getString("precioVenta"));

            adapRegVenta.add(object, igual);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void venta_seleccion_subvar(String id, JSONObject subvar) {
        JSONObject object = new JSONObject();
        try {
            object.put("id", id);
            object.put("subvariacion", subvar.getString("nombre"));
            object.put("cantidad", "1");
            if (jsonArticulos.getJSONObject(id).has("descuento")) {
                object.put("descuento", jsonArticulos.getJSONObject(id).getString("descuento"));
            } else {
                object.put("precio", jsonArticulos.getJSONObject(id).getString("precioVenta"));
            }
            if (jsonArticulos.getJSONObject(id).has("3x2")) {
                object.put("3x2", "");
            }
            if (jsonArticulos.getJSONObject(id).has("mayoreo")) {
                object.put("mayoreo", jsonArticulos.getJSONObject(id).getString("mayoreo"));
                object.put("cantMayoreo", jsonArticulos.getJSONObject(id).getString("cantMayoreo"));
            }
            object.put("nombrePublico", jsonArticulos.getJSONObject(id).getString("nombre") + " - " + subvar.getString("nombre"));
            object.put("descripcion", jsonArticulos.getJSONObject(id).getString("referencia"));
            object.put("precio", jsonArticulos.getJSONObject(id).getString("precioVenta"));

            adapRegVenta.add(object, false);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void enTurno_iniciar(){
        List<String> list = new ArrayList<>();
        try {
            String eqt = getString(R.string.equipoDeTrabajo);
            for (int i = 0; i < jsonDatos.getJSONObject(eqt).names().length(); i++){
                if(!jsonDatos.getJSONObject(eqt).names().getString(i).equals("huella")){
                    if(jsonDatos.getJSONObject(eqt).getJSONObject(jsonDatos.getJSONObject(eqt).names().getString(i)).has("status")){
                        JSONObject object = jsonDatos.getJSONObject(eqt).getJSONObject(jsonDatos.getJSONObject(eqt).names().getString(i));
                        if(object.getString("status").equals("1") && object.getString("corte").equals("1")){
                            list.add(object.getString("nombre"));
                        }
                    }
                }
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        RecyclerView recyclerView = (RecyclerView)findViewById(R.id.recyclerView_equipoTrabajo);
        generales.recyclerVertical(recyclerView, getApplicationContext());
        adapter.adapEnturno adapEnturno = new adapEnturno(this, list, getApplicationContext());
        recyclerView.setAdapter(adapEnturno);
        if(!generales.loadData_sharedPreferences(getApplicationContext(), key_corte, name_corte).equals("")) {
            try {
                JSONObject obj = new JSONObject(generales.loadData_sharedPreferences(getApplicationContext(), key_corte, name_corte));
                enTurno.setText(obj.getString("enTurno"));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else {
            enTurno.setText("SIN ASIGNAR");
        }
    }
    public void enTurnoSinConexion(){
        if(!generales.loadData_sharedPreferences(getApplicationContext(), key_corte, name_corte).equals("")) {
            try {
                JSONObject obj = new JSONObject(generales.loadData_sharedPreferences(getApplicationContext(), key_corte, name_corte));
                enTurno.setText(obj.getString("enTurno"));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    }

    public void actualizarAutocomplete(){

        ArrayList<String> arrayList = generales.init_getArrayList_AutocompleteCodigo();

        autoComplete_codigoArt.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, arrayList));
    }
    private void verificarPermisoNotificaciones() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }
    }

    private void activarBluetooth() {

        //activar bluetooth
        String[] permisosBluetooth = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN, // Para Android 11 o inferior
                Manifest.permission.BLUETOOTH_SCAN,  // Para Android 12 o superior
                Manifest.permission.BLUETOOTH_CONNECT // Para Android 12 o superior
        };

        if (ContextCompat.checkSelfPermission(
                getApplicationContext(), permisosBluetooth[0]) == PackageManager.PERMISSION_GRANTED) {
            try {
                BluetoothAdapter mBluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

                if (mBluetoothAdapter == null) {
                    // El dispositivo no soporta Bluetooth
                    Toast.makeText(this, "El dispositivo no soporta Bluetooth", Toast.LENGTH_SHORT).show();
                } else if (!mBluetoothAdapter.isEnabled()) {
                    // El Bluetooth no está habilitado, solicita al usuario que lo habilite
                    Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                    bluetoothLauncher.launch(enableBtIntent);
                } else {
                    // El Bluetooth ya está habilitado, puedes continuar con tus operaciones
                }
            } catch (Exception e) {
                e.printStackTrace();
                Toast.makeText(this, "Error al intentar habilitar Bluetooth: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }

        } else {
            ActivityCompat.requestPermissions(principal.this,
                    permisosBluetooth,
                    CODIGO_PERMISOS_BLUETHOT);
        }

    }
    private ActivityResultLauncher<Intent> bluetoothLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK) {
                    // El Bluetooth fue habilitado
                    Toast.makeText(this, "Bluetooth habilitado", Toast.LENGTH_SHORT).show();
                } else {
                    // El usuario no habilitó el Bluetooth
                    Toast.makeText(this, "Bluetooth no fue habilitado", Toast.LENGTH_SHORT).show();
                }
            }
    );
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
    private void t(String s){
        generales.toast(s, getApplicationContext());
    }

    @Override
    public void onPanelSlide(View panel, float slideOffset) {

    }

    @Override
    public void onPanelStateChanged(View panel, SlidingUpPanelLayout.PanelState previousState, SlidingUpPanelLayout.PanelState newState) {

    }
    public void salir(){
        this.finish();
    }
    int salir_void = 0;
    @Override
    public void onBackPressed() {
        if(sliding.getPanelState().equals(SlidingUpPanelLayout.PanelState.EXPANDED)){
            sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
        }else {
            pop.preguntar_salir_app salirApp = new preguntar_salir_app();
            salirApp.showPopupWindow(getWindow().getDecorView(), this);
        }
        if (salir_void>0)super.onBackPressed();
    }
    private void quitarMArcadorBillete(){
        if(billete == 20){
            ((TextView)findViewById(R.id.butBilleteVeinte2)).setVisibility(View.GONE);
        }else if(billete == 50){
            ((TextView)findViewById(R.id.butBilleteCincuenta2)).setVisibility(View.GONE);
        }else if(billete == 100){
            ((TextView)findViewById(R.id.butBilleteCien2)).setVisibility(View.GONE);
        }else if(billete == 200){
            ((TextView)findViewById(R.id.butBilleteDocientos2)).setVisibility(View.GONE);
        }else if(billete == 500){
            ((TextView)findViewById(R.id.butBilleteQuinientos2)).setVisibility(View.GONE);
        }else if(billete == 1000){
            ((TextView)findViewById(R.id.butBilleteMil2)).setVisibility(View.GONE);
        }
    }
    private void moverMarcadorBillete(int billete){
        if(montoPago.isEnabled()){
            montoPago.setText(String.valueOf(billete));
        }
    }

    static boolean unaVezMensajesIniciar= false;

    private BroadcastReceiver updateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            try {
                String llave = intent.getStringExtra("datos");
                String data = intent.getStringExtra("extra_data");
                if (llave.equals("mensaje")) {
                    actualizarMensajesPop(new JSONObject(data));
                } else if (llave.equals("mostrarBotonTransferencia")) {
                    JSONObject object = new JSONObject(data);
                    /** mostrarBotonTransferencia **/
                    if(object.getString("mostrarBotonTransferencia").equals("1")){
                        ((Button)findViewById(R.id.button199)).setVisibility(View.VISIBLE);
                    }else {
                        ((Button)findViewById(R.id.button199)).setVisibility(View.GONE);
                    }
                } else if (llave.equals("mostrarBotonPagoTarjeta")) {
                    JSONObject object = new JSONObject(data);
                    /** mostrarBotonPagoTarjeta **/
                    if(object.getString("mostrarBotonPagoTarjeta").equals("1")){
                        consPAgoTarjetaBoton.setVisibility(View.VISIBLE);
                    }else {
                        consPAgoTarjetaBoton.setVisibility(View.GONE);
                    }
                } else if (llave.equals("ultima_venta")) {
                    calcularIngresoDia();
                }else if (llave.equals("transferencia_datos")) {
                    /** transferencia_datos **/
                    try {
                        JSONObject object_ = new JSONObject(data);
                        //banco
                        ((TextView)findViewById(R.id.textView8)).setText(object_.getString("banco"));
                        //trjeta
                        ((TextView)findViewById(R.id.textView4)).setText(object_.getString("tarjeta"));
                        //referencia
                        ((TextView)findViewById(R.id.textView7)).setText(object_.getString("referencia"));
                        //titular
                        ((TextView)findViewById(R.id.textView9)).setText(object_.getString("titular"));
                        //banco
                        //((TextView)findViewById(R.id.textView8)).setText("");

                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
    };

    public void calcularIngresoDia() {
        try {
            if (jsonVenta == null || jsonVenta.length() == 0) {
                txtIngresoDia.setText("$ 0");
                return;
            }
            String hoyAño = generales.quitarCero(generales.getAnñoMesDiaHora("año"));
            String hoyMes = generales.quitarCero(generales.getAnñoMesDiaHora("mes"));
            String hoyDia = generales.quitarCero(generales.getAnñoMesDiaHora("dia"));

            if (jsonVenta.has(hoyAño)
                    && jsonVenta.getJSONObject(hoyAño).has(hoyMes)
                    && jsonVenta.getJSONObject(hoyAño).getJSONObject(hoyMes).has(hoyDia)) {
                JSONObject diaObj = jsonVenta.getJSONObject(hoyAño).getJSONObject(hoyMes).getJSONObject(hoyDia);
                JSONArray arrayVenta = diaObj.getJSONArray("registro");
                int totalIngreso = 0;
                for (int i = 0; i < arrayVenta.length(); i++) {
                    totalIngreso += Integer.parseInt(arrayVenta.getJSONObject(i).getString("montoCobro"));
                }
                txtIngresoDia.setText("$ " + totalIngreso);
            } else {
                txtIngresoDia.setText("$ 0");
            }
        } catch (Exception e) {
            txtIngresoDia.setText("$ 0");
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        calcularIngresoDia();
        ((Button)findViewById(R.id.button201)).setVisibility(View.GONE);
        if(mostrarBotonTransferencia()){
            ((Button)findViewById(R.id.button199)).setVisibility(View.VISIBLE);
        }else {
            ((Button)findViewById(R.id.button199)).setVisibility(View.GONE);
        }
        if(mostrarBotonPagoTarjeta()){
            ((ConstraintLayout) findViewById(R.id.consPAgoTarjetaBoton)).setVisibility(View.VISIBLE);
        }else {
            ((ConstraintLayout) findViewById(R.id.consPAgoTarjetaBoton)).setVisibility(View.GONE);
        }
        if(informacionTransferencia()){
            try {
                JSONObject object = new JSONObject(
                        generales.loadData_sharedPreferences(getApplicationContext(), "transferencia_datos", getApplicationContext().getString(R.string.transferencia_datos)));
                //banco
                ((TextView)findViewById(R.id.textView8)).setText(object.getString("banco"));
                //trjeta
                ((TextView)findViewById(R.id.textView4)).setText(object.getString("tarjeta"));
                //referencia
                ((TextView)findViewById(R.id.textView7)).setText(object.getString("referencia"));
                //titular
                ((TextView)findViewById(R.id.textView9)).setText(object.getString("titular"));
                //banco
                //((TextView)findViewById(R.id.textView8)).setText("");

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else {
            ((TextView)findViewById(R.id.textView8)).setText("NOMBRE BANCO");
            //trjeta
            ((TextView)findViewById(R.id.textView4)).setText("NUMERO TARJETA");
            //referencia
            ((TextView)findViewById(R.id.textView7)).setText("REFERENCIA");
            //titular
            ((TextView)findViewById(R.id.textView9)).setText("TITULAR");
        }
        if(unaVezMensajesIniciar) mensajeRecibidoCargadoEnshar();
        else unaVezMensajesIniciar = true;

        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_venta_ac");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mensajes_ac");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mostrarBotonTransferencia");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_mostrarBotonPagoTarjeta");
        intentFilter.addAction("FIRESTORE_UPDATE_ACTION_transferencia_datos");
        LocalBroadcastManager.getInstance(this).registerReceiver(updateReceiver, intentFilter);

    }

    @Override
    protected void onStop() {
        super.onStop();
        LocalBroadcastManager.getInstance(this).unregisterReceiver(updateReceiver);
    }
    public boolean mostrarBotonTransferencia(){
        boolean estado;
        /** mostrarBotonTransferencia **/
        if(generales.loadData_sharedPreferences(getApplicationContext(), "mostrarBotonTransferencia", getApplicationContext().getString(R.string.mostrarBotonTransferencia)).equals("0")
                ||generales.loadData_sharedPreferences(getApplicationContext(), "mostrarBotonTransferencia", getString(R.string.mostrarBotonTransferencia)).equals("")
        )estado=false;
        else estado = true;
        return estado;
    }
    public boolean informacionTransferencia(){
        boolean estado = false;
        /** Dar ticket **/
        if(generales.loadData_sharedPreferences(getApplicationContext(), "transferencia_datos", getString(R.string.transferencia_datos)).equals(""))estado=false;
        else estado = true;
        return estado;
    }
    public boolean mostrarBotonPagoTarjeta(){
        boolean estado;
        /** Dar ticket **/
        if(generales.loadData_sharedPreferences(getApplicationContext(), "mostrarBotonPagoTarjeta", getApplicationContext().getString(R.string.mostrarBotonPagoTarjeta)).equals("0")
                ||generales.loadData_sharedPreferences(getApplicationContext(), "mostrarBotonPagoTarjeta", getString(R.string.mostrarBotonPagoTarjeta)).equals("")
        )estado=false;
        else estado = true;
        return estado;
    }
    private void mensajeRecibidoCargadoEnshar(){
        String cant_share = loadData_sharedPreferences(getApplicationContext(),"key_cant_mensaje","mensaje");
        if(!cant_share.equals("")){
            int mensjeRecibido;
            mensjeRecibido = Integer.parseInt(cant_share);
            saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", String.valueOf(mensjeRecibido));
            TextView textView = (TextView)findViewById(R.id.textView_mensaje);
            textView.setVisibility(View.VISIBLE);
            String cant = "+ " + String.valueOf(mensjeRecibido);
            textView.setText(cant);
            ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_naranja));
        }else {
            ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_blamco));
            TextView textView = (TextView)findViewById(R.id.textView_mensaje);
            textView.setVisibility(View.GONE);
            textView.setText("");
        }
    }
    private void mensajeRecibidoAlIniciar(){
        String cant_share = loadData_sharedPreferences(getApplicationContext(),"key_cant_mensaje","mensaje");
        if(!cant_share.equals("")){
            int mensjeRecibido;
            mensjeRecibido = Integer.parseInt(cant_share);
            saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", String.valueOf(mensjeRecibido));
            TextView textView = (TextView)findViewById(R.id.textView_mensaje);
            textView.setVisibility(View.VISIBLE);
            String cant = "+ " + String.valueOf(mensjeRecibido);
            textView.setText(cant);
            MediaPlayer mpMensaje;
            mpMensaje = MediaPlayer.create(getApplicationContext(), R.raw.notificacion_1);
            mpMensaje.setVolume(100, 100);
            ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_naranja));
            mpMensaje.start();
        }
    }
    public void actualizarMensajesPop(JSONObject object){
        if (pop_mensajes != null && pop_mensajes.estadoPop()) {
            pop_mensajes.addJSON_adapter(object);
        } else {
            String cant_share = loadData_sharedPreferences(getApplicationContext(),"key_cant_mensaje","mensaje");
            int mensjeRecibido;
            if(!cant_share.equals("")){
                mensjeRecibido = Integer.parseInt(cant_share) + 1;
                saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", String.valueOf(mensjeRecibido));
            }else {
                mensjeRecibido = 1;
                saveData_sharedPreferences(getApplicationContext(),"mensaje", "key_cant_mensaje", "1");
            }
            TextView textView = (TextView)findViewById(R.id.textView_mensaje);
            textView.setVisibility(View.VISIBLE);
            String cant = "+ " + String.valueOf(mensjeRecibido);
            textView.setText(cant);
            MediaPlayer mpMensaje;
            mpMensaje = MediaPlayer.create(getApplicationContext(), R.raw.notificacion_1);
            mpMensaje.setVolume(100, 100);
            ((Button)findViewById(R.id.button70Mensaje)).setBackgroundDrawable(getResources().getDrawable(R.drawable.mensaje_naranja));
            mpMensaje.start();
        }
    }

    static boolean initAp = false;
    @Override
    public void onNetworkAvailable() {
        runOnUiThread(() -> {
            initAp = true;
        });
    }

    @Override
    public void onNetworkLost() {
        runOnUiThread(() -> {

        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        networkMonitor.unregisterNetworkCallback();
    }

    public void restoreSelectedDeviceIfExists() {
        SharedPreferences prefs = getSharedPreferences("MyAppSettings", MODE_PRIVATE);
        String savedMAC = prefs.getString("SelectedPrinterMAC", null);

        if (savedMAC != null) {
            // Intentar obtener el dispositivo a partir de la dirección MAC
            BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
            if (bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
                BluetoothDevice device = bluetoothAdapter.getRemoteDevice(savedMAC);
                if (device != null) {
                    // Aquí tienes el BluetoothDevice. Ahora crea la conexión como lo hace tu librería.
                    // Por ejemplo, si tu librería permite crear la conexión así:
                    // BluetoothConnection restoredConnection = new BluetoothConnection(device);
                    // Luego:
                    selectedDevice_static = new BluetoothConnection(device);
                    // Si es necesario, puedes probar si se conecta correctamente.
                } else {
                    // No se encontró el dispositivo, puede que ya no esté disponible.
                    // En este caso, el usuario tendrá que seleccionar de nuevo.
                    toast("SELECCIONE UNA IMPRESORA", getApplicationContext());
                    selectedDevice_static = null;
                }
            } else {
                // El Bluetooth no está habilitado o no se pudo acceder al adaptador
                // Considera pedir al usuario que lo active.
                toast("SELECCIONE UNA IMPRESORA", getApplicationContext());
                selectedDevice_static = null;
            }
        } else {
            // No había nada guardado, el usuario debe seleccionar un dispositivo.
            toast("SELECCIONE UNA IMPRESORA", getApplicationContext());
            selectedDevice_static = null;
        }
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
}

