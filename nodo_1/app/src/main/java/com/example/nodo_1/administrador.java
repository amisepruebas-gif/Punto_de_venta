package com.example.nodo_1;

import static com.example.nodo_1.generales.toast;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import fragmentVenta.principal_venta;
import fragmentVenta.venta_clase;
import propiedades_articulos.articulos_por_precio;
import propiedades_articulos.editar_propiedades;

public class administrador extends AppCompatActivity implements View.OnClickListener {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.administrador_v2);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

    }

    @Override
    public void onClick(View view) {

        Intent askIntent = null;
        if(R.id.but_masvendido == view.getId()){
             askIntent = new Intent(this, principal_venta.class);
        } else if (R.id.butAgregar_articulos == view.getId()) {
            askIntent = new Intent(this, ingresoMercancia.class);
        } else if (R.id.butEditar_articulos == view.getId()){
            askIntent = new Intent(this, editar_articulos.class);
        } else if (R.id.but_vistatodosArticulos == view.getId()) {
            askIntent = new Intent(this, vistaArticulosTodos.class);
        } else if (R.id.but_gestor_de_ofertas == view.getId()){
            askIntent = new Intent(this, editar_propiedades.class);
        } else if (R.id.butEquipo_de_trabajo == view.getId()) {
            askIntent = new Intent(this, equipo_de_trabajo.class);
        } else if (R.id.butAjustes == view.getId()) {
            askIntent = new Intent(this, ajustes.class);
        } else if (R.id.butArticulosPor_precio  == view.getId()) {
            askIntent = new Intent(this, articulos_por_precio.class);
        } else if (R.id.but_corte_menu_1 == view.getId()){
            askIntent = new Intent(this, corte_hist.class);
        }
        if(askIntent!=null)someActivityResultLauncher.launch(askIntent);
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

                        }else toast("no paso 2", getApplicationContext());
                    }
                }
            });
}
