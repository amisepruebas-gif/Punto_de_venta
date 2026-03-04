package adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

public class adapTicketCero extends RecyclerView.Adapter<adapTicketCero.ViewHolder> {

    JSONArray jsonArray = new JSONArray();
    public adapTicketCero(JSONArray array){
        this.jsonArray = array;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.ticketcero, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        ConstraintLayout constraintLayout = holder.constraintLayout;
        if(position == 0){
            constraintLayout.setVisibility(View.VISIBLE);
        }else {
            constraintLayout.setVisibility(View.GONE);
        }
        TextView
                itemRecyclerCant = holder.itemRecyclerCant,
                itemRecyclerDesc = holder.itemRecyclerDesc,
                itemRecyclerPrecio = holder.itemRecyclerPrecio,
                precioUnitario = holder.precioUnitario;
        try {
            itemRecyclerCant    .setText(jsonArray.getJSONObject(position).getString("cantidad"));
            precioUnitario      .setText(jsonArray.getJSONObject(position).getString("precio"));
            itemRecyclerDesc    .setText(jsonArray.getJSONObject(position).getString("descripcion"));
            itemRecyclerPrecio  .setText(String.valueOf(
                    Integer.parseInt(jsonArray.getJSONObject(position).getString("cantidad")) * Integer.parseInt(jsonArray.getJSONObject(position).getString("precio"))));

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        return jsonArray.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        ConstraintLayout constraintLayout;
        TextView itemRecyclerCant,itemRecyclerDesc,itemRecyclerPrecio ,precioUnitario;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            constraintLayout = (ConstraintLayout)itemView.findViewById(R.id.constraintLayout5);

            itemRecyclerCant    = (TextView)itemView.findViewById(R.id.itemRecyclerCant);
            itemRecyclerDesc    = (TextView)itemView.findViewById(R.id.itemRecyclerDesc);
            itemRecyclerPrecio  = (TextView)itemView.findViewById(R.id.itemRecyclerPrecio);
            precioUnitario      = (TextView)itemView.findViewById(R.id.itemRecyclerPrecio3);

        }
    }
}
