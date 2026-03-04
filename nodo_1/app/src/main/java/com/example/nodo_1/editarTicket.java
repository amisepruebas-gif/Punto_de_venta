package com.example.nodo_1;

import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.generales.toast;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import pop.popEditarTicket;

public class editarTicket extends AppCompatActivity implements View.OnClickListener {

    String proviene;
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.editar_ticket);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);


        String nameTienda = "NOMBRE NEGOCIO",direccion = "DIRECCION";
        String ms1 = "Encuentranos en:", ms2 = "EJEMPLO 1", ms3 = "EJEMPLO 2", ms4 = "VUELVA PRONTO";


        JSONObject datos = returnString(getString(R.string.datosTicket));
        if (datos != null){
            try {
                for (int i = 0; i < datos.names().length(); i++){
                    if(datos.has(getString(R.string.ticket_1)))nameTienda   = datos.getString(getString(R.string.ticket_1));
                    if(datos.has(getString(R.string.ticket_2)))direccion    = datos.getString(getString(R.string.ticket_2));
                    if(datos.has(getString(R.string.ticket_3)))ms1          = datos.getString(getString(R.string.ticket_3));
                    if(datos.has(getString(R.string.ticket_4)))ms2          = datos.getString(getString(R.string.ticket_4));
                    if(datos.has(getString(R.string.ticket_5)))ms3          = datos.getString(getString(R.string.ticket_5));
                    if(datos.has(getString(R.string.ticket_6)))ms4          = datos.getString(getString(R.string.ticket_6));
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            };
        }

        ((TextView)findViewById(R.id.nomNegocio))                   .setText(nameTienda);
        ((TextView)findViewById(R.id.textViewDireccion_editTicket)) .setText(direccion);
        ((TextView)findViewById(R.id.textViewInfo_1_editTicket))    .setText(ms1);
        ((TextView)findViewById(R.id.textViewInfo_2_editTicket))    .setText(ms2);
        ((TextView)findViewById(R.id.textViewInfo_3_editTicket))    .setText(ms3);
        ((TextView)findViewById(R.id.textViewInfo_4_editTicket))    .setText(ms4);
    }

    @Override
    public void onClick(View view) {
        if(R.id.butEditarTicket_1 == view.getId()){
            proviene = getString(R.string.ticket_1);
        } else if (R.id.butEditarTicket_2 == view.getId()) {
            proviene = getString(R.string.ticket_2);
        } else if (R.id.butEditarTicket_3 == view.getId()) {
            proviene = getString(R.string.ticket_3);
        } else if (R.id.butEditarTicket_4 == view.getId()) {
            proviene = getString(R.string.ticket_4);
        } else if (R.id.butEditarTicket_5 == view.getId()) {
            proviene = getString(R.string.ticket_5);
        } else if (R.id.butEditarTicket_6 == view.getId()) {
            proviene = getString(R.string.ticket_6);
        }
        if(R.id.butGuargarCambiosecitTicket == view.getId()){
            if(object.length() > 0){
                generales.saveData_sharedPreferences(getApplicationContext(),proviene, proviene, object.toString());
                subirDatos(getString(R.string.datosTicket) ,object.toString(),  getString(R.string.datosTicket));
            }
        }else {
            pop.popEditarTicket popEditarTicket = new popEditarTicket();
            popEditarTicket.showPopupWindow(view, this, proviene);
        }
    }

    int cantDatos = 0;
    JSONObject object = new JSONObject();
    public void getTextPop(String getTextPop, String proviene){
        try {
            object.put(proviene, getTextPop);
            if(proviene.equals(getString(R.string.ticket_1)))((TextView)findViewById(R.id.nomNegocio)).setText(getTextPop);
            if(proviene.equals(getString(R.string.ticket_2)))((TextView)findViewById(R.id.textViewDireccion_editTicket)).setText(getTextPop);
            if(proviene.equals(getString(R.string.ticket_3)))((TextView)findViewById(R.id.textViewInfo_1_editTicket)).setText(getTextPop);
            if(proviene.equals(getString(R.string.ticket_4)))((TextView)findViewById(R.id.textViewInfo_2_editTicket)).setText(getTextPop);
            if(proviene.equals(getString(R.string.ticket_5)))((TextView)findViewById(R.id.textViewInfo_3_editTicket)).setText(getTextPop);
            if(proviene.equals(getString(R.string.ticket_6)))((TextView)findViewById(R.id.textViewInfo_4_editTicket)).setText(getTextPop);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
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
                        toast("CARGANDO", getApplicationContext());
                    }
                }).addOnFailureListener(new OnFailureListener() {
                    @Override
                    public void onFailure(@NonNull Exception e) {
                        generales.toast("FALLO AL ACRUALIZAR DATOS", getApplicationContext());
                    }
                });

    }

    private JSONObject returnString(String string){
        JSONObject s = new JSONObject();
        if(!loadData_sharedPreferences(getApplicationContext(), string, string).equals("")){
            try {
                s = new JSONObject(loadData_sharedPreferences(getApplicationContext(), string, string));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else {
            s = null;
        }
        return  s;
    }
}
