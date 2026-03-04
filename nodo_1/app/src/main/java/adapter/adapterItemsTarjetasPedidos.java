package adapter;

import static com.example.nodo_1.principal.jsonPedido;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adapterItemsTarjetasPedidos extends RecyclerView.Adapter<adapterItemsTarjetasPedidos.ViewHolder> {
    JSONArray array = new JSONArray();
    Context context;
    public adapterItemsTarjetasPedidos(Context context, String idArt) {
        this.context = context;
        try {
            array = jsonPedido.getJSONObject(idArt).getJSONArray("abonos");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_apartado, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView
                itemNoTarjetaApartado   = holder.itemNoTarjetaApartado,
                itemTerjetaAbono        = holder.itemTerjetaAbono,
                itemfechaTarjetaAbAp    = holder.itemfechaTarjetaAbAp,
                itemTerjetaResta        = holder.itemTerjetaResta;

        try {
            itemNoTarjetaApartado.setText(String.valueOf(position + 1));
            JSONObject object = array.getJSONObject(position);
            itemfechaTarjetaAbAp.setText(object.getString("fecha"));
            itemTerjetaAbono    .setText(object.getString("cantidad"));
            itemTerjetaResta    .setText(object.getString("resta"));

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView itemNoTarjetaApartado, itemTerjetaAbono, itemTerjetaResta, itemfechaTarjetaAbAp,
                signoPesosTargetaAbAp;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            signoPesosTargetaAbAp = (TextView)itemView.findViewById(R.id.signoPesosTargetaAbAp);
            itemNoTarjetaApartado = (TextView)itemView.findViewById(R.id.itemNoTarjetaApartado);
            itemTerjetaAbono = (TextView)itemView.findViewById(R.id.itemTerjetaAbono);
            itemTerjetaResta = (TextView)itemView.findViewById(R.id.itemTerjetaResta);
            itemfechaTarjetaAbAp = (TextView)itemView.findViewById(R.id.itemfechaTarjetaAbAp);
        }
    }
    void toast(String s){
        generales.toast(s, context);
    }
}

/*
 itemNoTarjetaApartado.setText(String.valueOf(position + 1));

        if(position == 0){
            try {
                total = Integer.parseInt(jsonPedido.getJSONObject(_id).getJSONObject("pedidos").getJSONObject(posicionA).getString("total"));
                int total_ = total;
                for (int x = 0; x < list.size(); x++){
                    total_ = total_ - Integer.parseInt(jsonPedido.getJSONObject(_id).getJSONObject("pagos").getJSONObject(posicionA).
                            getString(String.valueOf(x + 1)).split("ç")[0]);
                }
            } catch (JSONException e) {
                toast("errorA");
                e.printStackTrace();
            }
        }
        itemTerjetaTotal.setText(String.valueOf(total));

        try {
            itemfechaTarjetaAbAp.setText( jsonPedido.getJSONObject(_id).getJSONObject("pagos").getJSONObject(posicionA).
                    getString(String.valueOf(position + 1)).split("ç")[1]);
            String abono = jsonPedido.getJSONObject(_id).getJSONObject("pagos").getJSONObject(posicionA).
                    getString(String.valueOf(position + 1)).split("ç")[0];
            itemTerjetaAbono.setText(abono);

            itemTerjetaResta.setText(String.valueOf(total - Integer.parseInt(abono)));

            total = total - Integer.parseInt(abono);
        } catch (JSONException e) {
            toast("error_Adap_Tarjetas_Pedidos A");
            e.printStackTrace();
        }
 */
