package adapter;

import android.content.Context;
import android.util.SparseBooleanArray;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONException;
import org.json.JSONObject;

public class adapVista_surtir_en_venta extends RecyclerView.Adapter<adapVista_surtir_en_venta.ViewHolder> {
    JSONObject object = new JSONObject();
    Context context;
    String surtirOmasvendido;
    adapterHistorialDos adapterHistorialDos;
    private SparseBooleanArray expandState = new SparseBooleanArray();
    adapVista_surtir_en_venta_r2 adap_venta_r2;
    public adapVista_surtir_en_venta(
            JSONObject object,
            Context context,
            String surtirOmasvendido,
            adapterHistorialDos adapterHistorialDos){
        this.adapterHistorialDos = adapterHistorialDos;
        this.surtirOmasvendido   = surtirOmasvendido;
        this.object = object;
        this.context = context;

        if(object.length() > 0){
            for (int i = 0; i < object.names().length(); i++){
                expandState.append(i, false);
            }
        }
    }


    public void reset(){
        if(object.length() > 0){
            object = new JSONObject();
            notifyDataSetChanged();
        }
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.vista_surtir_en_venta, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    int color = -1;
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView id = holder.id;
        RecyclerView recyclerView = holder.recyclerView;
        generales.recyclerVertical(recyclerView, context);


        Button button = holder.button;

        final boolean isExpanded = expandState.get(position);
        recyclerView.setVisibility(isExpanded ? View.VISIBLE : View.GONE);

        if(position==color){
            button.setBackground(context.getResources().getDrawable(R.drawable.blanco_muy_red));
            button.setTextColor(context.getResources().getColor(R.color.naranja_fuerte));
        }else {
            button.setBackground(context.getResources().getDrawable(R.drawable.naranja_muy_red));
            button.setTextColor(context.getResources().getColor(R.color.blanco));
        }

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                /*
                if (color> -1){
                    notifyItemChanged(color);
                }
                color = holder.getAdapterPosition();
                 */
                expandState.put(holder.getAdapterPosition(), !isExpanded);
                notifyItemChanged(holder.getAdapterPosition());
            }
        });

        if(surtirOmasvendido.equals("surtir")){
            try {
                int cant = object.getJSONArray(object.names().getString(position)).length();
                if (cant < 4){
                    recyclerView.setVisibility(View.VISIBLE);
                }
                button.setText("+ " + String.valueOf(cant) + " registros");
                adap_venta_r2 = new adapVista_surtir_en_venta_r2(
                        object.getJSONArray(object.names().getString(position)),
                        context,
                        adapterHistorialDos);
                recyclerView.setAdapter(adap_venta_r2);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else {
            try {
                int cant = object.getJSONArray(object.names().getString(position)).length();
                if (cant < 4){
                    recyclerView.setVisibility(View.VISIBLE);
                }
                button.setText("+ " + String.valueOf(cant) + " registros");
                adapVista_verMasVendido_en_ventas
                        adap_masVendido_r2 =
                        new adapVista_verMasVendido_en_ventas(
                                object.getJSONArray(object.names().getString(position)),
                                context,
                                adapterHistorialDos);
                recyclerView.setAdapter(adap_masVendido_r2);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }


        try {
            id.setText(object.names().getString(position));

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        if(object.length() > 0){
            return object.names().length();
        } else return 0;
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView id;
        RecyclerView recyclerView;
        Button button;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            id              = (TextView) itemView.findViewById(R.id.textView16);
            recyclerView    = (RecyclerView) itemView.findViewById(R.id.recycler_surtir_enVenta_r2);
            button                  = (Button) itemView.findViewById(R.id.button68);
        }
    }
}
