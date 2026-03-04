package adapter;

import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonDatos;

import android.content.Context;
import android.graphics.drawable.Drawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

public class adpPopTalla  extends RecyclerView.Adapter<adpPopTalla.ViewHolder> {

    JSONArray array = new JSONArray();
    pop.popVariacion_venta popVariacion_venta;
    Context context;
    public adpPopTalla(pop.popVariacion_venta popVariacion_venta, String id, Context context){
        this.popVariacion_venta = popVariacion_venta;
        this.context = context;
        try {
            if (jsonArticulos.getJSONObject(id).has("talla")){
                array = jsonDatos.getJSONObject("tallas").getJSONArray("tallas");
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    String selec = "";
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.nombres_sub_var, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    int inColor = -1;
    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button button = holder.button;
        try {
            button.setText(array.getString(position));

            Drawable color;
            if(position != inColor){
                color = ContextCompat.getDrawable(context, R.drawable.red_morado);
            }else {
                color = ContextCompat.getDrawable(context, R.drawable.naranja_muy_red);
            }
            button.setBackgroundDrawable(color);

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    inColor = holder.getAdapterPosition();
                    popVariacion_venta.setTallaSelec(array.getString(holder.getAdapterPosition()));
                    notifyDataSetChanged();
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button button;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            button = (Button) itemView.findViewById(R.id.button10);
        }
    }
}
