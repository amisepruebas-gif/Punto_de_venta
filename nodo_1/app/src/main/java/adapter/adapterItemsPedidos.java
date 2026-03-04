package adapter;
// No.4 e8 -3  4 9 2pz

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;

import org.json.JSONArray;
import org.json.JSONException;


public class adapterItemsPedidos extends RecyclerView.Adapter<adapterItemsPedidos.ViewHolder> {

    JSONArray array = new JSONArray();
    Context context;
    public adapterItemsPedidos(Context context, String idAp) {
        this.context = context;
        try {
           array = principal.jsonPedido.getJSONObject(idAp).getJSONArray("articulos");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_apartado_recycler, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView itemCant_ap = holder.itemCant_ap, itemNombreApartado = holder.itemNombreApartado,
                itemTotalCant_ap = holder.itemTotalCant_ap, precioUnitario = holder.precioUnitario;


        try {
            String cantidad = array.getJSONObject(position).getString("cantidad");
            String precio   = array.getJSONObject(position).getString("precio");
            itemNombreApartado.setText(array.getJSONObject(position).getString("nombrePublico"));
            itemCant_ap.       setText(cantidad);
            precioUnitario.    setText(precio);

            itemTotalCant_ap.setText(String.valueOf(Integer.parseInt(precio) * Integer.parseInt(cantidad)));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView itemCant_ap, itemNombreApartado, itemTotalCant_ap, precioUnitario;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            itemCant_ap        = (TextView)itemView.findViewById(R.id.itemCant_ap);
            itemNombreApartado = (TextView)itemView.findViewById(R.id.itemNombreApartado);
            itemTotalCant_ap   = (TextView)itemView.findViewById(R.id.itemTotalCant_ap);
            precioUnitario     = (TextView)itemView.findViewById(R.id.textView321);
        }
    }
    void toast(String s){
        generales.toast(s, context);
    }
}
