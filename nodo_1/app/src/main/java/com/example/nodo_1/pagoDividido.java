package com.example.nodo_1;

import static com.example.nodo_1.principal.cambioFormaPago_string;
import static com.example.nodo_1.principal.datos_cambioFormaPago;
import static com.example.nodo_1.principal.pagoEfectivo;
import static com.example.nodo_1.principal.pagoTransferencia;

import android.content.Context;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;
public class pagoDividido {

    ConstraintLayout consPagoConTarjeta, consPagoDividido_abajo;
    ConstraintLayout consPAgoTarjetaBoton, cons_info_trans;
    JSONObject jsonVenta_actual;

    TextView total_principal, txtRestaPagoDiv, restaPagoDividivido, texPagoDiv;
    TextView txt_comicion_tarjeta, txt_total_tarjeta, texto_resta_pagoDiv;

    EditText montoPago;

    Button butMasUnaVenta, butTransferencia, butPagoIgual, butConfTransferencia;
    Button pagarConTarjeta_cambioPago;

    String datosPagoDividido;

    Context context;
    pagoDividido(

            ){

    }


    public void pop_pagoDividido(

            Context context,
            Button pagarConTarjeta_cambioPago,
            ConstraintLayout consPagoConTarjeta,
            ConstraintLayout consPagoDividido_abajo,
            ConstraintLayout consPAgoTarjetaBoton,
            ConstraintLayout cons_info_trans,
            JSONObject jsonVenta_actual,
            TextView total_principal,
            TextView txtRestaPagoDiv,
            TextView restaPagoDividivido,
            TextView texPagoDiv,
            TextView txt_comicion_tarjeta,
            TextView txt_total_tarjeta,
            TextView texto_resta_pagoDiv,
            EditText montoPago,
            Button butMasUnaVenta,
            Button butTransferencia,
            Button butPagoIgual,
            Button butConfTransferencia,
            String datosPagoDividido

            ,String movimiento, String cantidad, String mov, String tituloPrimerPago){
        this.context                    = context;
        this.pagarConTarjeta_cambioPago = pagarConTarjeta_cambioPago;
        this.consPagoConTarjeta         = consPagoConTarjeta;
        this.consPagoDividido_abajo     = consPagoDividido_abajo;
        this.consPAgoTarjetaBoton       = consPAgoTarjetaBoton;
        this.cons_info_trans            = cons_info_trans;
        this.jsonVenta_actual           = jsonVenta_actual;
        this.total_principal            = total_principal;
        this.txtRestaPagoDiv            = txtRestaPagoDiv;
        this.restaPagoDividivido        = restaPagoDividivido;
        this.texPagoDiv                 = texPagoDiv;
        this.txt_comicion_tarjeta       = txt_comicion_tarjeta;
        this.txt_total_tarjeta          = txt_total_tarjeta;
        this.texto_resta_pagoDiv        = texto_resta_pagoDiv;
        this.montoPago                  = montoPago;
        this.butMasUnaVenta             = butMasUnaVenta;
        this.butTransferencia           = butTransferencia;
        this.butPagoIgual               = butPagoIgual;
        this.butConfTransferencia       = butConfTransferencia;
        this.datosPagoDividido          = datosPagoDividido;

        try {
            pagarConTarjeta_cambioPago  .setVisibility(View.GONE);
            consPagoConTarjeta          .setVisibility(View.GONE);
            jsonVenta_actual.put(principal.pagoDividido         , movimiento);
            JSONObject object = new JSONObject();
            object.put("cantidad_movimiento"    , cantidad);
            object.put("movimiento"             , movimiento);
            object.put("mov", mov);
            int resta = Integer.parseInt(total_principal.getText().toString()) - Integer.parseInt(cantidad);

            object.put("cantidad_faltante"  , String.valueOf(resta));
            object.put("pago", cantidad);

            consPagoDividido_abajo  .setVisibility(View.VISIBLE);

            if(mov.equals("TRANSFERENCIA-TARJETA")){
                txtRestaPagoDiv         .setText(String.valueOf(resta));
                restaPagoDividivido     .setText(cantidad);
            }else {
                txtRestaPagoDiv         .setText(cantidad);
                restaPagoDividivido.setText(String.valueOf(resta));
            }
            texPagoDiv              .setText(tituloPrimerPago);

            String comision = "",totConComicion;

            float generarComision; int comision_f;
            switch (mov){
                case "TARJETA-EFECTIVO":
                    pagarConTarjeta_cambioPago.setVisibility(View.VISIBLE);
                    butMasUnaVenta      .setVisibility(View.GONE);
                    butTransferencia    .setVisibility(View.GONE);
                    butPagoIgual        .setVisibility(View.GONE);
                    consPAgoTarjetaBoton.setVisibility(View.GONE);

                    generarComision = (Float.parseFloat(cantidad) * 0.04f);
                    comision_f = Math.round(generarComision);
                    comision = String.valueOf(comision_f);
                    object.put("comision", comision);
                    totConComicion = String.valueOf(
                            Integer.parseInt(comision) + Integer.parseInt(cantidad));
                    object.put("totalConComision",totConComicion);


                    consPagoConTarjeta.setVisibility(View.VISIBLE);
                    txt_comicion_tarjeta.setText(comision);
                    txt_total_tarjeta   .setText(totConComicion);
                    //pagoTarjeta(totConComicion, pagoDividido);
                    break;
                case "TRANSFERENCIA-EFECTIVO":
                    butPagoIgual.setVisibility(View.GONE);
                    consPAgoTarjetaBoton.setVisibility(View.GONE);
                    butConfTransferencia.setVisibility(View.VISIBLE);

                    Drawable d; int color;
                    cons_info_trans     .setVisibility(View.VISIBLE);
                    montoPago           .setEnabled(true);
                    montoPago           .setText("");

                    d       = context.getResources().getDrawable(R.drawable.medio_red_morado);
                    color   = ContextCompat.getColor(context, R.color.blanco);
                    butTransferencia.setBackgroundDrawable(d);
                    butTransferencia.setTextColor(color);

                    break;
                case "TRANSFERENCIA-TARJETA":
                    butPagoIgual.setVisibility(View.GONE);
                    consPAgoTarjetaBoton.setVisibility(View.GONE);
                    butConfTransferencia.setVisibility(View.VISIBLE);

                    texto_resta_pagoDiv.setText("TARJETA-RESTA");

                    d       = context.getResources().getDrawable(R.drawable.medio_red_morado);
                    color   = ContextCompat.getColor(context, R.color.blanco);
                    cons_info_trans     .setVisibility(View.VISIBLE);

                    montoPago           .setEnabled(false);
                    butTransferencia    .setBackgroundDrawable(d);
                    butTransferencia    .setTextColor(color);

                    generarComision = (Float.parseFloat(cantidad) * 0.04f);
                    comision_f = Math.round(generarComision);
                    comision = String.valueOf(comision_f);

                    object.put("comision", comision);

                    totConComicion = String.valueOf(
                            Integer.parseInt(comision) + Integer.parseInt(cantidad));
                    object.put("totalConComision",totConComicion);
                    break;
            }
            try {
                jsonVenta_actual.put(datosPagoDividido, object);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void cambiarFormaPago(
            ConstraintLayout consCambioFormaPago,
            ConstraintLayout consCambioPago_Trans,
            ConstraintLayout consCambioPago_Tarjeta,
            TextView cambioPAgo_Titulo,
            TextView cambioPago_trans,
            TextView cambioPago_tarjeta_comision,
            TextView cambioPago_Tarjeta_GranTotal,
            String formaPago,
            String operacion,
            adapter.adap_nom_id_jsonventa adap_nom_id_jsonventa
            ){
        consCambioFormaPago         .setVisibility(View.VISIBLE);
        consCambioPago_Trans        .setVisibility(View.GONE);
        consCambioPago_Tarjeta      .setVisibility(View.GONE);
        butConfTransferencia        .setVisibility(View.GONE);
        cambioPAgo_Titulo           .setText(operacion);
        cons_info_trans             .setVisibility(View.GONE);
        consPagoConTarjeta          .setVisibility(View.GONE);
        try {
            montoPago.setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("cantidad_faltante"));
            if(jsonVenta_actual.has(datos_cambioFormaPago)){jsonVenta_actual.remove(datos_cambioFormaPago);}
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        if(formaPago.equals(pagoTransferencia))
        {
            consCambioPago_Trans.setVisibility(View.VISIBLE);
            try {
                cambioPago_trans.setText(jsonVenta_actual.getJSONObject(datosPagoDividido).getString("cantidad_faltante"));
                butConfTransferencia.setVisibility(View.VISIBLE);
                cons_info_trans     .setVisibility(View.VISIBLE);
                jsonVenta_actual    .put(cambioFormaPago_string,pagoTransferencia);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        else if(formaPago.equals(principal.pagoTarjeta))
        {
            try {
                String totalTarjeta = jsonVenta_actual.getJSONObject(datosPagoDividido).getString("cantidad_faltante");
                String comision = String.valueOf(Math.round(Float.parseFloat(totalTarjeta) * 0.04f));

                String totalConComision = String.valueOf(Integer.parseInt(totalTarjeta) + Integer.parseInt(comision));

                consPagoConTarjeta          .setVisibility(View.VISIBLE);

                txt_comicion_tarjeta.setText(comision);
                txt_total_tarjeta   .setText(totalConComision);

                cambioPago_tarjeta_comision.setText(comision);
                cambioPago_Tarjeta_GranTotal.setText(totalConComision);
                montoPago                   .setText(totalConComision);

                JSONObject datosPagoTarjeta = new JSONObject();
                datosPagoTarjeta.put("sin_comision",        total_principal.getText().toString());
                datosPagoTarjeta.put("comision",            comision);
                datosPagoTarjeta.put("total_pago_tarjeta",  totalConComision);

                jsonVenta_actual.put(cambioFormaPago_string,    principal.pagoTarjeta);
                jsonVenta_actual.put(datos_cambioFormaPago,     datosPagoTarjeta);

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        else if (formaPago.equals(pagoEfectivo))
        {
            try {
                jsonVenta_actual.put(cambioFormaPago_string,pagoEfectivo);
                montoPago.setText("");
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        adap_nom_id_jsonventa.actualizar();
    }
}
