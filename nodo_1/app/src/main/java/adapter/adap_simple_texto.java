package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

public class adap_simple_texto extends RecyclerView.Adapter<adap_simple_texto.ViewHolder> {

   JSONArray array = new JSONArray();
    pop.popCantidadPRecios popCantidadPRecios;

    public void addPop(pop.popCantidadPRecios popCantidadPRecios){
        this.popCantidadPRecios = popCantidadPRecios;
    }
    public void add(JSONArray array){
        this.array = array;
        notifyDataSetChanged();
    }


    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.simple_boton, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button button = holder.button;
        button.setGravity(Gravity.CENTER_VERTICAL);
        try {
            button.setText("  " + array.getString(position) + "   " + "cantidad: " + jsonArticulos.getJSONObject(array.getString(position)).getString("cantidad"));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        return array.length();
    }


    public class ViewHolder extends RecyclerView.ViewHolder {
        Button button;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            button = (Button) itemView.findViewById(R.id.button86);
        }
    }
}
