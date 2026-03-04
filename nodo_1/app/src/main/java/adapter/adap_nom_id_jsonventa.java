package adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.principal;

import org.json.JSONException;

public class adap_nom_id_jsonventa extends RecyclerView.Adapter<adap_nom_id_jsonventa.ViewHolder> {

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.nom_id_jsn_venta, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView textView = holder.textView;
        try {
            textView.setText(principal.jsonVenta_actual.names().getString(position));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public void actualizar(){
        notifyDataSetChanged();
    }
    @Override
    public int getItemCount() {
        if(principal.jsonVenta_actual.length() > 0){
            return principal.jsonVenta_actual.names().length();
        }else return 0;
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView textView;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            textView = (TextView) itemView.findViewById(R.id.textView57);
        }
    }
}
