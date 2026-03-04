package adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

public class adapVista_verMasVendido_en_ventas extends RecyclerView.Adapter<adapVista_verMasVendido_en_ventas.ViewHolder>{

    Context context;
    JSONArray array;
    adapterHistorialDos adapterHistorialDos;
    public adapVista_verMasVendido_en_ventas(
            JSONArray array,
            Context context, adapterHistorialDos adapterHistorialDos){
        this.array      = array;
        this.context    = context;
        this.adapterHistorialDos = adapterHistorialDos;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.vista_mas_vendido_en_venta, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    private boolean estadocolor = false;
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView cantidad = holder.cantidad, nombre = holder.nombre,
                descripcion = holder.descripcion, linea = holder.linea, hora = holder.hora;
        Button verVenta = holder.verVenta;
        ConstraintLayout cons = holder.cons;
        if(array.length()>1)linea.setVisibility(View.VISIBLE);
        else linea.setVisibility(View.GONE);
        try {
            nombre      .setText(array.getJSONObject(position).getString("nombrePublico"));
            descripcion .setText(array.getJSONObject(position).getString("descripcion"));
            cantidad    .setText(array.getJSONObject(position).getString("cantidad"));
            hora        .setText(array.getJSONObject(position).getString("hora"));

            if(!estadocolor){
                estadocolor = true;
                cons.setBackgroundColor(context.getResources().getColor(R.color.gris_medio));
            }else {
                estadocolor = false;
                cons.setBackgroundColor(context.getResources().getColor(R.color.gris_oscuro));
            }

            verVenta.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    try {
                       int rastro_index_adap_1 = Integer.parseInt(array.getJSONObject(holder.getAdapterPosition()).getString("rastro_index_adap_1"));
                        int rastro_index_adap_2 = Integer.parseInt(array.getJSONObject(holder.getAdapterPosition()).getString("rastro_index_adap_2"));
                        adapterHistorialDos.ventaSelecVerVenta(
                                rastro_index_adap_1,
                                rastro_index_adap_2,
                                array.getJSONObject(holder.getAdapterPosition()).getString("id"));
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {

        Button verVenta;
        TextView cantidad, nombre, descripcion, linea, hora;
        ConstraintLayout cons;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            nombre      = itemView.findViewById(R.id.textviewNombre_r_mas_vendido);
            cantidad    = itemView.findViewById(R.id.textviewNombre_r5_mas_vendido);
            descripcion = itemView.findViewById(R.id.textviewNombre_r3_mas_vendido);
            linea       = itemView.findViewById(R.id.textviewNombre_r7_mas_vendido);
            hora        = itemView.findViewById(R.id.textviewNombre_r2_mas_vendido3);
            verVenta    = itemView.findViewById(R.id.button67);
            cons        = itemView.findViewById(R.id.consreg_vistamas_ven_en_venta);
        }
    }
}
