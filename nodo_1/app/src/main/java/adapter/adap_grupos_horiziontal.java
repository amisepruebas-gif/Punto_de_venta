package adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

import propiedades_articulos.tallas;

public class adap_grupos_horiziontal extends RecyclerView.Adapter<adap_grupos_horiziontal.ViewHolder> {
    JSONArray array;
    propiedades_articulos.tallas tallas;
    Context context;
    public adap_grupos_horiziontal(JSONArray array, tallas tallas, Context context){
        this.array  = array;
        this.tallas = tallas;
        this.context = context;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.simple_but_corto_delgado, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    int index = -1;
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button button = holder.button, eliminar = holder.eliminar;
        try {
            button.setText(array.getString(position));
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        if (position == index){
            button.setBackground(context.getDrawable(R.drawable.medio_red_azul_datos_segmento));
            button.setTextColor(context.getColor(R.color.blanco));
        }else {
            button.setBackground(context.getDrawable(R.drawable.blanco_medio_red));
            button.setTextColor(context.getColor(R.color.azulDatosSegmento));
        }
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    tallas.setGrupoVer(array.getString(holder.getAdapterPosition()));
                    if (index >= 0){
                        notifyItemChanged(index);
                    }
                    index = holder.getAdapterPosition();
                    notifyItemChanged(index);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        eliminar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    tallas.remove_pop(array.getString(holder.getAdapterPosition()));
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
    }
    public void remove(int removeIndex){
        array.remove(removeIndex);
        notifyItemRemoved(removeIndex);
    }

    public void actualizarTodo(JSONArray array){
        this.array = array;
        notifyDataSetChanged();
    }
    public void colorButton_index(int index){
        this.index = index;
    }
    public int getColorIndexButton(){return index;}
    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button button, eliminar;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            button      = (Button) itemView.findViewById(R.id.button7);
            eliminar    = (Button) itemView.findViewById(R.id.button11);
        }
    }
}
