package adapter;


import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonPedido;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.pedidos;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class adapterClientesPedidos extends RecyclerView.Adapter<adapterClientesPedidos.ViewHolder> {

    JSONArray array = new JSONArray();
    Context context;
    adapterPedidosContenedorPrincipal   adap;
    RecyclerView                        recyclerArticulosPedidos;
    pedidos                             pedidos;
    public adapterClientesPedidos (Context context, RecyclerView recyclerArticulosPedidos, pedidos pedidos, String statusSeleccion){
        this.pedidos = pedidos;
        this.context = context;
        this.recyclerArticulosPedidos = recyclerArticulosPedidos;
        generales.recyclerVertical(this.recyclerArticulosPedidos, context);
        if(jsonClientes.length() > 0){
            for (int x = 0; x < jsonClientes.names().length(); x++){
                try {
                    /** DUFERENTE DE 0 - > 0 = INACTIVO**/
                    String status =
                            jsonPedido.getJSONObject(jsonClientes.getJSONObject(jsonClientes.names().getString(x)).getString("ultimoApartado")).getString("status");
                    if (status.equals(statusSeleccion)){
                        JSONObject object = new JSONObject();
                        object.put("idCliente", jsonClientes.names().getString(x));
                        object.put("idApartado",jsonClientes.getJSONObject(jsonClientes.names().getString(x)).getString("ultimoApartado"));
                        object.put("nombre",    jsonClientes.getJSONObject(jsonClientes.names().getString(x)).getString("nombre"));
                        object.put("numeroCel", jsonClientes.getJSONObject(jsonClientes.names().getString(x)).getString("numeroTelefono"));
                        object.put("status", status);
                        array.put(object);
                        if (array.length() == 1){
                            pedidos.setIdCliente (object.getString("idCliente"));
                            pedidos.setIdApartado(object.getString("idApartado"));
                            adap =
                                    new adapterPedidosContenedorPrincipal(object.getString("idCliente"), context);
                            recyclerArticulosPedidos.setAdapter(adap);
                        }
                        //if (!principal.jsonPedido.getString("status").equals("0")){
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        }
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_clientes_pedidos, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button butVerRegistrosDePedidos = holder.butVerRegistrosDePedidos;
        final TextView
                intemNombreCliente =            holder.intemNombreCliente,
                intemEstadoPedido =             holder.intemEstadoPedido,   id_regApCliente =       holder.id_regApartado,
                intemIDRegPrin =                holder.intemIDRegPrin,      itemAdapCliPed =        holder.itemAdapCliPed,
                terminaEn_textView =            holder.terminaEn_textView;
        ConstraintLayout consIDCliente_ap = holder.consIDCliente_ap;

        try {
            int color;
            if(position == 0){
                color = ContextCompat.getColor(context, R.color.amarilloSuave);
            }else {
                color = ContextCompat.getColor(context, R.color.blanco);
            }
            consIDCliente_ap.setBackgroundColor(color);

            JSONObject obj = array.getJSONObject(position);

            intemNombreCliente .setText(obj.getString("nombre"));
            intemIDRegPrin     .setText(obj.getString("numeroCel"));
            long diasTermina = daysUntil(jsonPedido.getJSONObject(obj.getString("idApartado")).getString("terminaTime"));
            terminaEn_textView.setText(
                    "Termina en: " +
                            String.valueOf(diasTermina) +
                    " días");

            if(diasTermina > 2){
                color(intemEstadoPedido,  R.drawable.bola_estado_verde);
            }else {
                color(intemEstadoPedido,  R.drawable.bola_estado_rojo);
            }

            butVerRegistrosDePedidos.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        pedidos.setIdCliente (obj.getString("idCliente"));
                        pedidos.setIdApartado(obj.getString("idApartado"));
                        adap =
                                new adapterPedidosContenedorPrincipal(obj.getString("idCliente"), context);
                        recyclerArticulosPedidos.setAdapter(adap);
                        if(holder.getAdapterPosition() != 0)swapElementsInJSONArray(holder.getAdapterPosition(), 0);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });


        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public void selec(String idCliente){
        try {
            int index = 0;
            for (int x = 0; x < array.length(); x++){
                if (array.getJSONObject(x).getString("idCliente").equals(idCliente)){
                    index = x;
                }
            }
            if(index != 0)swapElementsInJSONArray(index, 0);
            adap = new adapterPedidosContenedorPrincipal(idCliente, context);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        recyclerArticulosPedidos.setAdapter(adap);
    }

    public void actualizar(){notifyDataSetChanged();}
    public void swapElementsInJSONArray( int i, int j) throws JSONException {
        // Verifica que los índices estén dentro del rango
        if (i >= 0 && i < array.length() && j >= 0 && j < array.length()) {
            // Obtiene los elementos en las posiciones i y j
            Object tempI = array.get(i);
            Object tempJ = array.get(j);

            // Intercambia los elementos
            array.put(i, tempJ);
            array.put(j, tempI);
            notifyItemMoved(i, j);
            notifyItemChanged(i);notifyItemChanged(j);
            if (array.length() > 1)notifyItemChanged(1);
        } else {
            throw new IndexOutOfBoundsException("Índices fuera de rango");
        }
    }
    public JSONObject getIDS_inicio(){
        if(array.length() > 0){
            JSONObject object = new JSONObject();
            try {
                object.put("cliente" , array.getJSONObject(0).getString("idCliente"));
                object.put("apartado", array.getJSONObject(0).getString("idApartado"));
                return object;
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else return null;
    }
    @Override
    public int getItemCount() {
        return array.length();
    }

    private void color(TextView textView, int color_){
        final int sdk = android.os.Build.VERSION.SDK_INT;//23 abr 2021 13:38:00

        if (sdk < android.os.Build.VERSION_CODES.JELLY_BEAN) {
            textView.setBackgroundDrawable(ContextCompat.getDrawable(context, color_));
        } else {
            textView.setBackground(ContextCompat.getDrawable(context, color_));
        }
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button butVerRegistrosDePedidos;
        TextView intemNombreCliente,    intemEstadoPedido,
                id_regApartado,         intemIDRegPrin,         itemAdapCliPed,
                terminaEn_textView;
        ConstraintLayout consIDCliente_ap;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            intemIDRegPrin              = (TextView)itemView.findViewById(R.id.intemIDRegPrin);
            butVerRegistrosDePedidos    = (Button)itemView.findViewById(R.id.butVerRegistrosDePedidos);
            intemNombreCliente          = (TextView)itemView.findViewById(R.id.intemNombreCliente);
            intemEstadoPedido           = (TextView)itemView.findViewById(R.id.intemEstadoPedido);
            id_regApartado              = (TextView)itemView.findViewById(R.id.id_regApartado);
            itemAdapCliPed              = (TextView)itemView.findViewById(R.id.itemAdapCliPed);
            terminaEn_textView          = (TextView) itemView.findViewById(R.id.terminaEn_textView);

            consIDCliente_ap            = (ConstraintLayout) itemView.findViewById(R.id.consIDCliente_ap);
        }
    }
    public static long daysUntil(String futureDateString) {
        // Define el formato de fecha
        SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy", Locale.getDefault());

        try {
            // Parsea la fecha futura
            Date futureDate = sdf.parse(futureDateString);

            // Obtiene la fecha actual y elimina la hora para una comparación precisa
            Calendar today = Calendar.getInstance();
            today.set(Calendar.HOUR_OF_DAY, 0);
            today.set(Calendar.MINUTE, 0);
            today.set(Calendar.SECOND, 0);
            today.set(Calendar.MILLISECOND, 0);
            Date currentDate = today.getTime();

            // Calcula la diferencia en milisegundos
            long diffInMillis = futureDate.getTime() - currentDate.getTime();

            // Convierte milisegundos a días
            long daysDifference = diffInMillis / (24 * 60 * 60 * 1000);

            // Asegura que no se devuelvan días negativos
            if (daysDifference >= 0) {
                return daysDifference;
            } else {
                return 0; // O puedes devolver un valor negativo si prefieres
            }
        } catch (ParseException e) {
            e.printStackTrace();
            return 0;
        }
    }
}
