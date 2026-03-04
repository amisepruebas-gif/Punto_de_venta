package com.example.nodo_1;

import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonPedido;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.MenuItem;
import android.view.View;
import android.view.WindowManager;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.PopupMenu;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.TimeZone;

import adapter.adapterAbonos;
import adapter.adapterClientesPedidos;
import pop.PopUpClass;
import pop.notacancelacion;
import pop.popAgrearAbonoAprtado;
import pop.pop_cancelar_apartado;
import pop.pop_liquidar_cancelar;


public class pedidos extends AppCompatActivity implements View.OnClickListener {

    private RecyclerView recyclerArticulosPedidos, recyclerHistorialAbonos,recyclerRegistroClientes_P;
    private Button                              but_printComp_Hist, but_filtroAp_popUp;
    private adapter.adapterClientesPedidos      adapterClientesPedidos;
    private ConstraintLayout                    consConfirmarCompra, consventarealizada;
    public static String statusRegActivosInac = "";
    public static int                           numeroReg = 0;
    public static  ArrayList<String> numeroRegArray = new ArrayList<String>(), idJsonPed = new ArrayList<String>();
    private Spinner                             spinnerEnturno;
    private AutoCompleteTextView                autocomplete_getClientes;
    private TextView                            itemTicket_Date, itemTicket_Enturno, itemTicket_MontoPago, itemTicket_MontoCobro, itemTicket_Resta, itemTicket_Cambio;
    private int                                 billete = 0;
    public static String                        editarAp = "null";
    private static boolean                      liquidarBol = false;
    adapterAbonos                               adapterAbonos;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.pedidos);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        if(jsonPedido.length() > 0){
            consConfirmarCompra         = (ConstraintLayout)findViewById(R.id.cons_ConComp);
            but_printComp_Hist          = (Button)findViewById(R.id.but_printComp_Hist);
            recyclerRegistroClientes_P  = (RecyclerView)findViewById(R.id.recyclerRegistroClientes_P);
            recyclerArticulosPedidos    = (RecyclerView)findViewById(R.id.recyclerArticulosPedidos);
            consventarealizada          = (ConstraintLayout)findViewById(R.id.consventarealizada);
            spinnerEnturno              = (Spinner)findViewById(R.id.spinnerEnturno);
            autocomplete_getClientes    = (AutoCompleteTextView) findViewById(R.id.autocomplete_getClientes);
            recyclerHistorialAbonos     = (RecyclerView)findViewById(R.id.recyclerHistorialAbonos);
            itemTicket_Date             = (TextView)findViewById(R.id.itemTicket_Date);
            itemTicket_Cambio           = (TextView)findViewById(R.id.itemTicket_Cambio);
            itemTicket_Enturno          = (TextView)findViewById(R.id.itemTicket_Enturno);
            itemTicket_MontoPago        = (TextView)findViewById(R.id.itemTicket_MontoPago);
            itemTicket_MontoCobro       = (TextView)findViewById(R.id.itemTicket_MontoCobro);
            itemTicket_Resta            = (TextView)findViewById(R.id.itemTicket_Resta);
            but_filtroAp_popUp          = (Button)findViewById(R.id.but_filtroAp_popUp);
            Button limpiarAutoNombre    = (Button)findViewById(R.id.button67);
            Button limpiarAutoIdTicket  = (Button)findViewById(R.id.button68);
            final AutoCompleteTextView
                    autocompIdApTicket  = (AutoCompleteTextView)findViewById(R.id.autocomplete_getClientes2);

            ((TextView)findViewById(R.id.textViewFechaActual)).setText(DateFormat.getDateInstance().format(new Date()));
            ((TextView)findViewById(R.id.itemfecha)).setText(DateFormat.getDateInstance().format(new Date()));


            Intent intent = getIntent();
            generales.recyclerVertical(recyclerRegistroClientes_P, getApplicationContext());

            // 0 equivalente a finalizado.
            String statusSeleccion = "1";
            adapterClientesPedidos = new adapterClientesPedidos(getApplicationContext(), recyclerArticulosPedidos, pedidos.this, statusSeleccion);
            recyclerRegistroClientes_P.setAdapter(adapterClientesPedidos);


            // Recupera el dato extra enviado desde la otra actividad
            if (intent != null && intent.hasExtra("idPedido")) {
                String idPedidoExtra = intent.getStringExtra("idPedido"); // Asegúrate de proveer un valor por defecto
                try {
                    idCliente =  jsonPedido.getJSONObject(idPedidoExtra).getString("cliente");
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                idApartado  = idPedidoExtra;
                adapterClientesPedidos.selec(idCliente);

            }else {
                if(adapterClientesPedidos.getItemCount() > 0){
                    try {
                        idCliente  = adapterClientesPedidos.getIDS_inicio().getString("cliente");
                        idApartado = adapterClientesPedidos.getIDS_inicio().getString("apartado");
                        adapterClientesPedidos.selec(idCliente);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }


            ArrayList<String> area = new ArrayList(){{add("Valeria");add("Jesús");}};
            spinnerEnturno.setAdapter(new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, area));
        }else toast("NO HAY DATOS REGISTRADOS");
    }
    void toast(String s){ generales.toast(s, getApplicationContext()); }
    @Override
    public void onClick(final View view) {
        if(R.id.cerrarEditAp == view.getId()){

        } else if (R.id.but_agregarAp_masdeuno == view.getId()) {
            try {
                if (jsonPedido.getJSONObject(idApartado).getString("status").equals("1")){
                    toast("HAY UN APARTADO EN CURSO");
                }else {
                    Intent intent = new Intent(this, pedidosAgregarReg.class);
                    intent.putExtra("idApartado", idApartado);
                    someActivityResultLauncher.launch(intent);
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        } else if (R.id.but_cancelarAp == view.getId()) {
            try {
                if (jsonPedido.getJSONObject(idApartado).getString("status").equals("1")){
                    if (jsonPedido.length() > 0){
                        pop_cancelar_apartado concelarApartado = new pop_cancelar_apartado();
                        concelarApartado.showPopupWindow(view, this);
                    }
                }else toast("NO HAY APARTADOS ACTIVOS");
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

        }else if (R.id.but_notaApartado == view.getId()) {
            String notaString = "";
            if(jsonClientes.length() > 0){
                try {
                    if(jsonClientes.getJSONObject(idCliente).has("nota")){
                        notaString = jsonClientes.getJSONObject(idCliente).getString("nota");
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
            pop.notacancelacion notacancelacion = new notacancelacion();
            notacancelacion.showPopupWindow(view, notaString, idCliente, "cliente");
        } else if (R.id.but_verOcultarAgregarAnt2 == view.getId()) {
            try {
                if (jsonPedido.getJSONObject(idApartado).getString("status").equals("1")){
                    if (jsonPedido.length() > 0){
                        pop.pop_liquidar_cancelar liquidarCancelar = new pop_liquidar_cancelar();
                        liquidarCancelar.showPopupWindow(view, "liquidar", this);
                    }
                }else toast("NO HAY APARTADOS ACTIVOS");
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }

        } else if (R.id.butXventanaTicketPedido == view.getId()) {

        }else if (R.id.cerrar_reciclerEditAp == view.getId()) {

        } else if (R.id.regresarRegPagos == view.getId()) {

        } else if (R.id.butConfirmarCompra_noTicket == view.getId()) {

        } else if (R.id.but_abono_ap == view.getId()) {
            try {
                if (jsonPedido.getJSONObject(idApartado).getString("status").equals("1")){
                    if (jsonPedido.length() > 0){
                        pop.popAgrearAbonoAprtado agregarPagoAp = new popAgrearAbonoAprtado();
                        agregarPagoAp.showPopupWindow(view, this);
                    }
                }else toast("NO HAY APARTADOS ACTIVOS");
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        } else if (R.id.butAgregarEditarRegPedidos == view.getId()) {
            Intent askIntent = new Intent(this, pedidosAgregarReg.class);
            askIntent.putExtra("clave", "valor");
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.butPlazoPedido == view.getId()) {

        } else if (R.id.but_filtroAp_popUp == view.getId()){
            PopupMenu popupMenu = new PopupMenu(pedidos.this, view);
            popupMenu.getMenuInflater().inflate(R.menu.menu_filtro_ap, popupMenu.getMenu());
            popupMenu.setOnMenuItemClickListener(new PopupMenu.OnMenuItemClickListener() {
                @Override
                public boolean onMenuItemClick(MenuItem menuItem) {
                    PopUpClass popUpClass;
                    if(R.id.butFiltroActivosAp == menuItem.getItemId()){
                        // 0 equivalente a finalizado.
                        String statusSeleccion = "1";
                        adapterClientesPedidos = new adapterClientesPedidos(getApplicationContext(), recyclerArticulosPedidos, pedidos.this, statusSeleccion);
                        recyclerRegistroClientes_P.setAdapter(adapterClientesPedidos);
                    }else if(R.id.butFiltroFinalizadosAp == menuItem.getItemId()){
                        // 0 equivalente a finalizado.
                        String statusSeleccion = "0";
                        adapterClientesPedidos = new adapterClientesPedidos(getApplicationContext(), recyclerArticulosPedidos, pedidos.this, statusSeleccion);
                        recyclerRegistroClientes_P.setAdapter(adapterClientesPedidos);
                    }
                    return false;
                }
            });
            popupMenu.show();
        }

    }

    String idApartado = "", idCliente = "", cantidadAbono = "";
    public void setIdApartado(String id){idApartado = id;}
    public void setIdCliente (String id){idCliente  = id;}

    boolean bolAbono = false, liquidar = false, cancelar = false;
    public void abono(String abonoCant){
        bolAbono = true; liquidarBol = false; cancelar = false;; cantidadAbono = abonoCant;
        onBackPressed();
    }
    public void liquidarPedido(){
        liquidar = true; bolAbono = false;cancelar = false;
        try {
            JSONArray ar = jsonPedido.getJSONObject(idApartado).getJSONArray("abonos");
            cantidadAbono = ar.getJSONObject(ar.length()-1).getString("resta");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        onBackPressed();
    }
    public void cancelarApartado(){
        cancelar = true;liquidar = false; bolAbono = false;
        toast("PEDIDO CANCELADO");
        try {
            jsonPedido.getJSONObject(idApartado).put("status", "0");
            fire.documenRef("apartados/" + idApartado).
                    update(new Gson().fromJson(
                            jsonPedido.getJSONObject(idApartado).toString(), HashMap.class));
            adapterClientesPedidos.actualizar();
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public void onBackPressed() {
        if(bolAbono || liquidar){
            Intent intent = new Intent(this, principal.class);
            JSONObject object = new JSONObject();
            try {
                object.put("cantidad", cantidadAbono);
                object.put("fecha",    sumarDiasAFecha(0));
                JSONArray ar =  principal.jsonPedido.getJSONObject(idApartado).getJSONArray("abonos");
                int totalAbonos = 0;
                for (int i = 0; i < ar.length(); i++){
                    totalAbonos = totalAbonos + Integer.parseInt(ar.getJSONObject(i).getString("cantidad"));
                }
                totalAbonos = totalAbonos + Integer.parseInt(cantidadAbono);
                object.put("resta", String.valueOf(
                        Integer.parseInt(principal.jsonPedido.getJSONObject(idApartado).getString("total")) - totalAbonos));

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            try {
                object.put("anticipo", cantidadAbono);
                object.put("numAp",    idApartado);
                object.put("nombre",   jsonClientes.getJSONObject(idCliente).getString("nombre"));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            String key = "", status = "1";
            if(bolAbono)key = "pedidos_2";
            else if (liquidar){
                key = "pedidos_3";status = "0";
            }
            try {
                object.put("status", status);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            if(!key.equals("")){
                intent.putExtra(key, object.toString());
                setResult(RESULT_OK, intent);
                finish();
            }else {

            }
        }else super.onBackPressed();
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
                            if(data.hasExtra("pedidos_1"))
                            {
                                String pedidos1Value = data.getStringExtra("pedidos_1");
                                Intent intent = new Intent(pedidos.this, principal.class);
                                intent.putExtra("pedidos_1", pedidos1Value);
                                setResult(RESULT_OK, intent);
                                finish();
                            }
                        }else generales.toast("no paso 2", getApplicationContext());
                    }
                }
            });
    private String sumarDiasAFecha(int dias) {
        // Establecer la zona horaria a "America/Mexico_City"
        TimeZone myTimeZone = TimeZone.getTimeZone("America/Mexico_City");

        // Obtener la fecha y hora actuales en la zona horaria especificada
        Calendar calendar = Calendar.getInstance(myTimeZone);

        // Sumar 'dias' días al calendario
        calendar.add(Calendar.DAY_OF_MONTH, dias);

        // Formatear la fecha resultante con año de cuatro dígitos
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("dd/MM/yyyy");
        simpleDateFormat.setTimeZone(myTimeZone);
        String fechaResultado = simpleDateFormat.format(calendar.getTime());

        return fechaResultado;
    }
}


