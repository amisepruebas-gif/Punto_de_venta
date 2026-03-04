package adapter;


import static com.example.nodo_1.principal.jsonPedido;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.icu.util.Calendar;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import fragmentVenta.por_fecha;


public class adapterHistorialDos extends RecyclerView.Adapter<adapterHistorialDos.ViewHolder> {

    JSONArray array;
    Context context;
    TextView sumaSeleccion;
    List<String> sumSelec = new ArrayList<>();
    String estadoBusquedaID;
    por_fecha por_fecha;
    RecyclerView recyclerView;
    String rastroFecha;
    public adapterHistorialDos(
            JSONArray array,
            Context context,
            TextView sumaSeleccion,
            String id,
            por_fecha por_fecha,
            RecyclerView recyclerView,
            String rastroFecha){
        this.por_fecha          = por_fecha;
        this.estadoBusquedaID   = id;
        this.sumaSeleccion      = sumaSeleccion;
        this.context            = context;
        this.array              = array;
        this.recyclerView       = recyclerView;
        this.rastroFecha        = rastroFecha;
        if(sumaSeleccion != null){
            sumaSeleccion.setText("0");
        }
        for (int i = 0; i < array.length(); i++){
            sumSelec.add("0");
        }
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_historial_dos, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    private void sumarSumaSeleccion(String s, boolean estado){
        if(sumaSeleccion.length() > 0){
            int i = Integer.parseInt(sumaSeleccion.getText().toString());
            int operacion;
            if(estado){
                operacion = Integer.parseInt(s) + i;
            } else {
                operacion = i - Integer.parseInt(s);
            }
            sumaSeleccion.setText(String.valueOf(operacion));
        }

    }

    int contSurtir = 0;
    public int getContSurtir(){return contSurtir;}

    public void surtirSelec_check(int index_1, int index_2, boolean estado) {
        recyclerView.scrollToPosition(index_1);
        try {
            if(lineaMorada_index >=0){

                int indexant = lineaMorada_index;
                lineaMorada_index = index_1;

                if (estado){
                    if (array.getJSONObject(index_1).has("2")){
                        array.getJSONObject(index_1).getJSONArray("2").put(String.valueOf(index_2));
                    }else {
                        JSONArray array1 = new JSONArray();
                        array1.put(String.valueOf(index_2));
                        array.getJSONObject(index_1).put("2", array1);
                    }
                }else {
                    if (array.getJSONObject(index_1).getJSONArray("2").length() > 0){
                        int index_borrar= -1;
                        for (int i = 0; i < array.getJSONObject(index_1).getJSONArray("2").length(); i++){
                            if(array.getJSONObject(index_1).getJSONArray("2").getString(i).equals(String.valueOf(index_2))){
                                index_borrar = i;
                            }
                        }
                        if (index_borrar >= 0){
                            array.getJSONObject(index_1).getJSONArray("2").remove(index_borrar);
                        }
                    }else {
                        array.getJSONObject(index_1).remove("2");
                    }
                }


                notifyItemChanged(indexant);
                notifyItemChanged(lineaMorada_index);
            }else {
                JSONArray array1 = new JSONArray();
                array1.put(String.valueOf(index_2));
                array.getJSONObject(index_1).put("2", array1);

                lineaMorada_index = index_1;


                notifyItemChanged(lineaMorada_index);
            }

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    int lineaMorada_index = -1;
    String idVenta = "";
    public String getIdVenta(){return idVenta;}
    public void ventaSelecVerVenta(int index_1, int index_2, String idArt) {
        recyclerView.scrollToPosition(index_1);
        try {
            if(lineaMorada_index >=0){
                if(index_1!=lineaMorada_index){
                    array.getJSONObject(lineaMorada_index).remove("1");
                }
                int indexant = lineaMorada_index;
                lineaMorada_index = index_1;
                array.getJSONObject(index_1).put("1",idArt);
                array.getJSONObject(index_1).put("3",String.valueOf(index_2));

                JSONArray arrayArtVenta = array.getJSONObject(indexant).getJSONArray("articulos");
                for (int x = 0; x < arrayArtVenta.length(); x++){
                    if(arrayArtVenta.getJSONObject(x).has("marca")){
                        arrayArtVenta.getJSONObject(x).remove("marca");
                    }
                }
                notifyItemChanged(indexant);
                notifyItemChanged(lineaMorada_index);
            }else {
                array.getJSONObject(index_1).put("1",idArt);
                array.getJSONObject(index_1).put("3",String.valueOf(index_2));
                lineaMorada_index = index_1;
                notifyItemChanged(lineaMorada_index);
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button cancelarventa                 = holder.cancelarventa;
        RecyclerView recyclerHistorial_tres  = holder.recyclerHistorial_tres;
        ConstraintLayout consEfectivo        = holder.consEfectivo,
                consApartado                 = holder.consApartado;
        TextView
                itemTotalVentaXVentaUnitaria = holder.itemTotalVentaXVentaUnitaria,
                granTotalTarjeta            = holder.granTotalTarjeta,
                fechaEvento                 = holder.fechaEvento,
                pagoColor                   = holder.pagoColor;
        CheckBox checkBoxSumar              = holder.checkBoxSumar;
        Button verApartado                  = holder.verApartado;
        TextView hora                       = holder.hora;

        try {
            hora.setText(array.getJSONObject(position).getString("fecha").split(" ")[3]);



        if(!estadoBusquedaID.equals("")){
            try {
                fechaEvento.setVisibility(View.VISIBLE);
                fechaEvento.setText(formatearFecha(array.getJSONObject(position).getString("id_registro")));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }

        if(array.getJSONObject(position).has("montoCobro")){
            itemTotalVentaXVentaUnitaria.setText(array.getJSONObject(position).getString("montoCobro"));
        }
        if(array.getJSONObject(position).has("apartado")){
            consApartado.setVisibility(View.VISIBLE);
            TextView idApartado = holder.idApartado, estadoAp = holder.estadoAp;
            try {
                String idAp = array.getJSONObject(position).getString("idApartado");
                idApartado.setText(idAp);
                if(array.getJSONObject(position).getString("apartado").equals("1")){
                    estadoAp.setText("ABONO"); estadoAp.setTextColor(Color.parseColor("#006CFF"));
                }  else {
                    estadoAp.setText("FINALIZADO"); estadoAp.setTextColor(Color.RED);
                }
                String estadoAp_string = jsonPedido.getJSONObject(idAp).getString("estado");
                switch (estadoAp_string){
                    case "0": estadoAp_string = "LIQUIDADO"; break;
                    case "1": estadoAp_string = "EN CURSO"; break;
                    case "2": estadoAp_string = "CANCELADO"; break;
                }
            } catch (JSONException e) { e.printStackTrace(); }

        } else consApartado.setVisibility(View.GONE);


        TextView
                itemNoVentaXDia = holder.itemNoVentaXDia,
                pago = holder.pago,
                cambio = holder.cambio,
                enturno = holder.enturno, tipoDePago = holder.tipoDePago;
        ImageView iconoTipoDeVenta = holder.iconoTipoDeVenta;
        iconoTipoDeVenta.setVisibility(View.VISIBLE);
        consEfectivo.setVisibility(View.VISIBLE);

        itemNoVentaXDia.setText(String.valueOf(position+1));

        try {
            enturno.setText(array.getJSONObject(position).getString("enTurno"));
            pago.setText(array.getJSONObject(position).getString("montoPago"));

            if (array.getJSONObject(position).getString("movimiento").equals("pagoTransferencia")) {
                tipoDePago.setText("TRANSFERENCIA");  iconoTipoDeVenta.setImageResource(R.drawable.transferenciauno);
                tipoDePago.setTextColor(context.getColor(R.color.azul));
                pagoColor.setVisibility(View.VISIBLE);
                cambio.setText("0");
            }
            if(array.getJSONObject(position).getString("movimiento").equals("pagoEfectivo")){
                tipoDePago.setText("EFECTIVO"); iconoTipoDeVenta.setImageResource(R.drawable.efectivo_uno);
                tipoDePago.setTextColor(context.getColor(R.color.azulverde));
                pagoColor.setVisibility(View.GONE);
                cambio.setText(array.getJSONObject(position).getString("cambio"));
            }
            if(array.getJSONObject(position).getString("movimiento").equals("pagoTarjeta")){
                tipoDePago.setText("TARJETA");  iconoTipoDeVenta.setImageResource(R.drawable.tarjeta_dos);
                tipoDePago.setTextColor(context.getColor(R.color.naranja_fuerte));
                pagoColor.setVisibility(View.VISIBLE);
                cambio.setText("0");
            }




        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        if(sumSelec.get(position).equals("0")){
            checkBoxSumar.setChecked(false);
        }else {
            checkBoxSumar.setChecked(true);
        }
        checkBoxSumar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    if(array.getJSONObject(holder.getAdapterPosition()).has("montoPago")){
                        sumarSumaSeleccion(itemTotalVentaXVentaUnitaria.getText().toString(), checkBoxSumar.isChecked());
                    } else {

                        sumarSumaSeleccion(granTotalTarjeta.getText().toString(),             checkBoxSumar.isChecked());
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                if(checkBoxSumar.isChecked()){
                    sumSelec.set(holder.getAdapterPosition(), "1");
                }
                else {
                    sumSelec.set(holder.getAdapterPosition(), "0");
                }
            }
        });
        recyclerHistorial_tres.setHasFixedSize(true);
        generales.recyclerVertical(recyclerHistorial_tres, context);

        JSONArray arrayArtVenta = new JSONArray();
        try {
            int ventaUnitaria = 0; boolean ventaVerDos = false;

            if(array.getJSONObject(position).has("ultimo_dia_registrado_en_venta")){
                arrayArtVenta = array.getJSONObject(position).getJSONArray("articulos");
            }
        } catch (JSONException e) {
            toast("error_H_2");
            e.printStackTrace();
        }

        if(arrayArtVenta.length() > 0){
            try {
                if(array.getJSONObject(position).has("2")){
                    JSONObject object = new JSONObject();
                    for (int i = 0; i < array.getJSONObject(position).getJSONArray("2").length(); i++){
                        int indice = Integer.parseInt(array.getJSONObject(position).getJSONArray("2").getString(i));
                        arrayArtVenta.getJSONObject(indice).put("marca", "");
                        object.put(String.valueOf(indice),"");
                    }

                    for (int i = 0; i < arrayArtVenta.length(); i++){
                        if(!object.has(String.valueOf(i))){
                            if (arrayArtVenta.getJSONObject(i).has("marca")){
                                arrayArtVenta.getJSONObject(i).remove("marca");
                            }
                        }
                    }
                }
                if(array.getJSONObject(position).has("1")){
                    int indice = Integer.parseInt(array.getJSONObject(position).getString("3"));
                    arrayArtVenta.getJSONObject(indice).put("marca", "");
                }

                adapterHistorialTres_actualizado adapterHistorialTres =
                        new adapterHistorialTres_actualizado(arrayArtVenta, por_fecha, context, estadoBusquedaID);
                recyclerHistorial_tres.setAdapter(adapterHistorialTres);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        cancelarventa.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {

            }
        });
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    ////ene. mar. abr. may. jun. jul. ago. sep.
    //12 mar. 2023 13:10:23
    private String fecha_a_id(String fecha, String s){
        if(s.equals("dia"))
        {
            return fecha.split(" ")[0];
        }
        else if (s.equals("mes"))
        {
            return mesA_numero(fecha.split(" ")[1]);
        } else
        {
            return fecha.split(" ")[2];
        }
    }
    private String mesA_numero(String mes){
        switch (mes){
            case "ene.":return "1";
            case "feb.":return "2";
            case "mar.":return "3";
            case "abr.":return "4";
            case "may.":return "5";
            case "jun.":return "6";
            case "jul.":return "7";
            case "ago.":return "8";
            case "sep.":return "9";
            case "oct.":return "10";
            case "nov.":return "11";
            case "dic.":return "12";
            default: return null;
        }
    }
    public JSONArray getArray(){return  array;}
    public int tamañoArray(){
        return array.length();
    }
    public void add(JSONObject object){
        array.put(object);
        sumSelec.add("0");
        notifyItemInserted(array.length()-1);
    }
    public void toast(String mensaje) {
        Toast toast = Toast.makeText(context, mensaje, Toast.LENGTH_LONG);
        toast.setGravity(Gravity.CENTER_HORIZONTAL, 0, 0);
        toast.show();
    }
    @Override
    public int getItemCount() {
        return array.length();
    }

    public String formatearFecha(String fecha) {
        try {
            // Formato de entrada
            SimpleDateFormat formatoEntrada = new SimpleDateFormat("yyyy MM dd", Locale.getDefault());

            // Convertir cadena a fecha
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(formatoEntrada.parse(fecha));

            // Obtener los componentes de la fecha
            int dia = calendar.get(Calendar.DAY_OF_MONTH);
            String diaSemana = new SimpleDateFormat("EEEE", Locale.getDefault()).format(calendar.getTime());
            String mes = new SimpleDateFormat("MMMM", Locale.getDefault()).format(calendar.getTime());
            int año = calendar.get(Calendar.YEAR);

            // Formatear y devolver
            return String.format(Locale.getDefault(), "%s %d de %s del %d",
                    capitalizeFirstLetter(diaSemana), dia, capitalizeFirstLetter(mes), año);
        } catch (Exception e) {
            e.printStackTrace();
            return "Error en la fecha";
        }
    }

    // Método para capitalizar la primera letra
    private String capitalizeFirstLetter(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        RecyclerView recyclerHistorial_tres;
        TextView itemTotalVentaXVentaUnitaria, itemNoVentaXDia, pago, cambio, hora, enturno;
        TextView granTotalTarjeta,
                idApartado, estadoAp, tipoDePago, fechaEvento;
        Button   cancelarventa, verApartado;
        ConstraintLayout consEfectivo, consTarjeta, consApartado;
        CheckBox checkBoxSumar;
        ImageView iconoTipoDeVenta;



        TextView pagoColor;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            consEfectivo                 = (ConstraintLayout)itemView.findViewById(R.id.constraintLayout56);
            pago                         = (TextView)itemView.findViewById(R.id.itemTotalVentaXVentaUnitaria2);
            cambio                       = (TextView)itemView.findViewById(R.id.itemTotalVentaXVentaUnitaria3);
            itemNoVentaXDia              = (TextView)itemView.findViewById(R.id.itemNoVentaXDia);

            itemTotalVentaXVentaUnitaria = (TextView)itemView.findViewById(R.id.itemTotalVentaXVentaUnitaria);
            recyclerHistorial_tres       = (RecyclerView)itemView.findViewById(R.id.recyclerHistorial_tres);
            hora                         = (TextView)itemView.findViewById(R.id.textView388);
            cancelarventa                = (Button)itemView.findViewById(R.id.button120);
            enturno                      = (TextView)itemView.findViewById(R.id.itemVentaEcha_por);

            tipoDePago                      = (TextView)itemView.findViewById(R.id.textView442);

            checkBoxSumar                   = (CheckBox)itemView.findViewById(R.id.checkBox2_h2);

            verApartado                     = (Button)itemView.findViewById(R.id.button2_h2);

            iconoTipoDeVenta                = (ImageView)itemView.findViewById(R.id.imageView28);
            consApartado                    = (ConstraintLayout)itemView.findViewById(R.id.constraintLayout61);
            idApartado                      = (TextView)itemView.findViewById(R.id.textView45_h2);
            estadoAp                        = (TextView)itemView.findViewById(R.id.textView7_h2);

            fechaEvento             = (TextView) itemView.findViewById(R.id.textView3_h2);

            pagoColor               = (TextView) itemView.findViewById(R.id.textView10_h2);


        }
    }
}
