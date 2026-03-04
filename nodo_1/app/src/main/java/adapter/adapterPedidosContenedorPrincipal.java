package adapter;

import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonPedido;

import android.annotation.SuppressLint;
import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

import pop.notacancelacion;

public class adapterPedidosContenedorPrincipal extends RecyclerView.Adapter<adapterPedidosContenedorPrincipal.ViewHolder> {
    int                 sizeRecycler;
    JSONArray           array = new JSONArray();
    private Context     context;
    JSONObject          jsonObject = new JSONObject();
    RecyclerView        recyclerVistaTarjetasPedidos = null;
    boolean             bandera = false;


    adapter.adapterItemsTarjetasPedidos adapterItemsTarjetasPedidos;

    public adapterPedidosContenedorPrincipal(String idCliente, Context context) {
        this.context = context;
        try {
            if (jsonClientes.getJSONObject(idCliente).has("listaAp")){
                JSONArray arrayAps = jsonClientes.getJSONObject(idCliente).getJSONArray("listaAp");
                for (int i = arrayAps.length()-1; i >= 0; i--){

                    JSONObject object = new JSONObject(jsonPedido.getJSONObject(arrayAps.getString(i)).toString());
                    if (i==arrayAps.length()-1)object.put("plegado", "1");
                    else object.put("plegado", "0");
                    array.put(object);
                }
            }else {
                array.put(jsonPedido.getJSONObject(jsonClientes.getJSONObject(idCliente).getString("ultimoApartado")));
                array.getJSONObject(0).put("plegado", "1");
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.contenedor_de_apartados_por_clienete, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @SuppressLint("SetTextI18n")
    @Override
    public void onBindViewHolder(@NonNull final ViewHolder holder, int position) {
        TextView
                noApTextView =          holder.noApTextView,            txtViewstatusReg =      holder.txtViewstatusReg, txtInicia = holder.txtIinica,
                txtTermina =            holder.txtTermina,              txtindicadorstatusap =  holder.txtindicadorstatusap,
                txtColor =              holder.txtColor,                idPedido = holder.idPedido,
                txtPlazo =              holder.txtPlazo,                txtIndicador =          holder.txtIndicador, notaCancelacionTxt = holder.notaCancelacionTxt;
        final
        Button
                but_desplegar        = holder.itemOcultarNoApartado,
                but_nota             = holder.butNota;
        ConstraintLayout consDesplegado = holder.itemConsNoApartado;


        try {
            if(array.getJSONObject(position).has("plegado")){
                if(array.getJSONObject(position).getString("plegado").equals("1")){
                    consDesplegado.setVisibility(View.VISIBLE);
                    but_desplegar.setRotation(180f);
                }
                else {
                    consDesplegado.setVisibility(View.GONE);
                    but_desplegar.setRotation(0f);
                }
                but_desplegar.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        try {
                            if(array.getJSONObject(holder.getAdapterPosition()).getString("plegado").equals("1")){
                                array.getJSONObject(holder.getAdapterPosition()).put("plegado", "0");
                            }else {
                                array.getJSONObject(holder.getAdapterPosition()).put("plegado", "1");
                            }
                            notifyItemChanged(holder.getAdapterPosition());
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                });
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        noApTextView.setText(String.valueOf(position + 1));

        RecyclerView recyclerContenedorApartados = holder.recyclerContenedorApartados;

        recyclerVistaTarjetasPedidos = holder.recyclerVistaTarjetasPedidos;
        final ConstraintLayout itemConsNoApartado = holder.itemConsNoApartado, consCancelado = holder.consCancelado;

        try {
            JSONObject object = array.getJSONObject(position);
            txtInicia .setText(object.getString("inicio"));
            txtTermina.setText(getDayName(object.getString("terminaTime")) + " " + object.getString("termina"));
            idPedido.setText(object.getString("numAp"));
            txtPlazo.setText(object.getString("plazo"));

            adapterItemsPedidos adapterItemsPedidos = new adapterItemsPedidos(context, object.getString("numAp"));
            initRecycler(recyclerContenedorApartados);
            recyclerContenedorApartados.setAdapter(adapterItemsPedidos);

            adapterItemsTarjetasPedidos =
                    new adapterItemsTarjetasPedidos(context, object.getString("numAp"));
            initRecyclerHorizontal(recyclerVistaTarjetasPedidos);
            recyclerVistaTarjetasPedidos.setAdapter(adapterItemsTarjetasPedidos);


            if (object.getString("status").equals("0")){
                txtViewstatusReg.setText("FINALI.");txtViewstatusReg.setTextColor(context.getColor(R.color.negro));
            }
            if (object.getString("status").equals("1")){
                txtViewstatusReg.setText("AVTIVO");txtViewstatusReg.setTextColor(context.getColor(R.color.azulDatosSegmento));
            }
            if (object.getString("status").equals("2")){
                txtViewstatusReg.setText("CANCEL..");txtViewstatusReg.setTextColor(context.getColor(R.color.rojosuave ));
            }

            but_nota.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    String notaString = "";
                    if(jsonPedido.length() > 0){
                        try {
                            if(jsonPedido.getJSONObject(object.getString("numAp")).has("nota")){
                                notaString = jsonPedido.getJSONObject(object.getString("numAp")).getString("nota");
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }
                    pop.notacancelacion notacancelacion = new notacancelacion();
                    try {
                        notacancelacion.showPopupWindow(view, notaString, object.getString("numAp"), "apartado");
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    void toast(String s){
        generales.toast(s, context);
    }

    public int getItemCount() {
       return array.length();
    }
    public class ViewHolder extends RecyclerView.ViewHolder {
        RecyclerView recyclerContenedorApartados, recyclerVistaTarjetasPedidos;
        Button itemOcultarNoApartado, butImpCoomprobante, butNota;
        ConstraintLayout itemConsNoApartado, consCancelado;
        TextView noApTextView, txtViewstatusReg, txtTermina, txtIinica, txtindicadorstatusap,
                 txtColor, idPedido, txtPlazo, txtIndicador, notaCancelacionTxt;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            txtIinica = (TextView)itemView.findViewById(R.id.txtInicia);
            txtTermina = (TextView)itemView.findViewById(R.id.txtTermina);
            txtViewstatusReg = (TextView) itemView.findViewById(R.id.txtViewstatusReg);
            noApTextView = (TextView) itemView.findViewById(R.id.noApTextView);
            itemOcultarNoApartado = (Button)itemView.findViewById(R.id.itemOcultarNoApartado);
            recyclerVistaTarjetasPedidos = (RecyclerView)itemView.findViewById(R.id.recyclerVistaTarjetasPedidos);
            recyclerContenedorApartados  = (RecyclerView)itemView.findViewById(R.id.recyclerContenedorApartados);
            itemConsNoApartado   = (ConstraintLayout)itemView.findViewById(R.id.itemConsNoApartado);
            txtindicadorstatusap = (TextView)itemView.findViewById(R.id.txtindicadorstatusap);
            consCancelado        =(ConstraintLayout)itemView.findViewById(R.id.consCanceladoPequeño);
            txtColor             = (TextView)itemView.findViewById(R.id.intemEstadoPedido2);
            idPedido             = (TextView)itemView.findViewById(R.id.idAp_reg);
            txtPlazo             = (TextView)itemView.findViewById(R.id.plazoAP_reg);
            txtIndicador         = (TextView)itemView.findViewById(R.id.textView318);
            butImpCoomprobante   = (Button)itemView.findViewById(R.id.itemOcultarNoApartado2);
            butNota              = (Button)itemView.findViewById(R.id.button56);
        }
    }
    private void initRecyclerHorizontal(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false));
    }
    private void initRecycler(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context));
    }
    private int caledario(int i){
        Date date = new Date();
        Calendar calendar = Calendar.getInstance();
        calendar.setFirstDayOfWeek( Calendar.MONDAY);
        calendar.setMinimalDaysInFirstWeek(4);
        calendar.setTime(date);
        return calendar.get(i);
    }
    private void color(TextView textView, int color_){
        final int sdk = android.os.Build.VERSION.SDK_INT;//23 abr 2021 13:38:00

        if (sdk < android.os.Build.VERSION_CODES.JELLY_BEAN) {
            textView.setBackgroundDrawable(ContextCompat.getDrawable(context, color_));
        } else {
            textView.setBackground(ContextCompat.getDrawable(context, color_));
        }
    }
    public static String getDayName(String dateString) {
        // Define el formato de la fecha de entrada
        SimpleDateFormat inputFormat = new SimpleDateFormat("dd/MM/yyyy", Locale.getDefault());

        // Define el formato para el nombre del día de la semana
        SimpleDateFormat dayNameFormat = new SimpleDateFormat("EEEE", new Locale("es", "ES"));

        try {
            // Parsea la fecha de entrada
            Date date = inputFormat.parse(dateString);

            // Obtiene el nombre del día de la semana
            String dayName = dayNameFormat.format(date);

            // Convierte la primera letra a mayúscula (opcional)
            dayName = dayName.substring(0, 1).toUpperCase() + dayName.substring(1).toLowerCase();

            return dayName;
        } catch (ParseException e) {
            e.printStackTrace();
            return null;
        }
    }

}

/*


                "[L]\n" +
                        "[C]<img>" + PrinterTextParserImg.bitmapToHexadecimalString(printer, context.getResources().getDrawableForDensity(R.drawable.amisetxtticket, DisplayMetrics.DENSITY_MEDIUM)) + "</img>\n"


      "[L]\n" +
                        "[C]Av. Juan N Álvarez, Col. Centro.\n" +
                        "[C]" + DateFormat.getDateTimeInstance().format(new Date()) + "\n"+
                        "[C]\n" +
                        "[L]INICIO : "             + inicia  + "\n" +
                        "[L]TERMINA: "             + termina + "\n" +
                        "[L]CLIENTE: "             + nombreCliente + "\n" +
                        "[L]CANT. DE ARTICULOS:  " + canArt + "\n" +
                        "[C]\n" +
                        "[C]\n" +
                        s +
                        "[L]\n" +
                        var +
                        "[R]TOTAL AP.:[R]"+ "$"+ total +".00"+"\n" +
                        "[R]RESTA:[R]"+ "$"+ String.valueOf(rest) + ".00"+"\n" +
                        "[L]\n" +
                        "[C]Facebook Pagina: \n" +
                        "[C]www.facebook.com/amise.tienda   \n" +//https://www.facebook.com/groups/1169038826793718/
                        "[C]\n" +
                        "[C]GRACIAS POR SU PREFERENCIA\n" +

                        "[L]\n"+
                        "[L]\n"+
                        "[L]\n"
 */









































































































/*
   txtInicia.setText(jsonObject.getJSONObject("pedidos").getJSONObject(String.valueOf(position+1)).getString("fechaInicio"));
            String ft = jsonObject.getJSONObject("pedidos").getJSONObject(String.valueOf(position+1)).getString("fechaTermina");
            if(ft.split(" ")[2].equals("Septiembre")){
                ft =
                        ft.split(" ")[0] + " " + ft.split(" ")[1] +
                                " " +  "Sep." + " " + ft.split(" ")[3] +  " " + ft.split(" ")[4];
            }
              adapterItemsTarjetasPedidos =
                    new adapterItemsTarjetasPedidos
                            (array, context,id, String.valueOf(position + 1), txtindicadorstatusap);
            recyclerVistaTarjetasPedidos.setAdapter(adapterItemsTarjetasPedidos);


            String estado_reg = jsonObject.getJSONObject("pedidos").getJSONObject(String.valueOf(position+1)).getString("estado");
            switch (estado_reg){
                case "0":
                    txtViewstatusReg.setText("PAGADO");
                    txtViewstatusReg.setTextColor(Color.BLACK);
                    break;
                case "1":
                    txtViewstatusReg.setText("ACTIVO");
                    txtViewstatusReg.setTextColor(Color.GREEN);
                    masDeUnActivo++;
                    break;
                case "2":
                    txtViewstatusReg.setText("NO RECOGIO");
                    txtViewstatusReg.setTextColor(Color.BLUE);
                    break;
                case "3":
                    txtViewstatusReg.setText("CANCELADO");
                    txtViewstatusReg.setTextColor(Color.RED);
                    break;
            }


            initRecyclerHorizontal(recyclerVistaTarjetasPedidos);
            ArrayList<String> array = new ArrayList<>();//articulos
            try {
                a = jsonObject.getJSONObject("pagos").getJSONObject(String.valueOf(position + 1)).length();
            } catch (JSONException e) {
                e.printStackTrace();
            }
            for (int i = 0; i < a; i++){//txtViewstatusReg
                array.add("");
            }



            bandera = true;
 */