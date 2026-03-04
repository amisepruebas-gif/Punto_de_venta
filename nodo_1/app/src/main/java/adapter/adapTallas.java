package adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

public class adapTallas extends RecyclerView.Adapter<adapTallas.ViewHolder> {

    JSONArray array = new JSONArray();
    boolean statusBorrar;
    public adapTallas(JSONArray array, boolean statusBorrar){
        this.statusBorrar = statusBorrar;
        if(array.length() > 0){
            this.array = array;
        }
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.resgistro_tallas, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button modificarTalla = holder.modificarTalla, borrar = holder.borrar;
        TextView talla = holder.talla;
        try {
            talla.setText(array.getString(position));

            if (statusBorrar){
                borrar.setVisibility(View.VISIBLE);
                borrar.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        array.remove(holder.getAdapterPosition());
                        notifyItemRemoved(holder.getAdapterPosition());
                    }
                });
            }else borrar.setVisibility(View.GONE);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public JSONArray getArray(){return array;}
    public void add(String s){
        array.put(s);
        notifyItemInserted(array.length()-1);
    }
    public void remove(int index){
        array.remove(index);
        notifyItemRemoved(index);
    }
    public void setClic(int index){
        try {
            if (index < 0 || index >= array.length()) {
                throw new IllegalArgumentException("Índice fuera de rango");
            }
            Object item = array.get(index);
            array.remove(index);

            // Crear una nueva JSONArray para reconstruir el orden
            JSONArray newArray = new JSONArray();
            newArray.put(item); // Agregar el elemento al inicio
            for (int i = 0; i < array.length(); i++) {
                newArray.put(array.get(i));
            }
            array = newArray; // Reemplazar el arreglo original

            notifyItemMoved(index, 0);
            notifyItemRangeChanged(0, index + 1);
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
    public void actualizarRegistro(JSONArray array){
        this.array = array;
        notifyDataSetChanged();
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button modificarTalla, borrar;
        TextView talla;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            talla = (TextView) itemView.findViewById(R.id.txtTalla_reg);
            modificarTalla = (Button) itemView.findViewById(R.id.butModificartalla_reg);
            borrar = (Button) itemView.findViewById(R.id.butEliminartalla_reg);
        }
    }
}
