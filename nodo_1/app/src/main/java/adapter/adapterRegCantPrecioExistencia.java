package adapter;

import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import propiedades_articulos.articulos_por_precio;

public class adapterRegCantPrecioExistencia extends RecyclerView.Adapter<adapterRegCantPrecioExistencia.ViewHolder> {

    JSONObject object = new JSONObject();
    Context context;
    int color = -1;
    propiedades_articulos.articulos_por_precio articulos_por_precio;
    public adapterRegCantPrecioExistencia(
            Context context,
            articulos_por_precio articulos_por_precio) {
        this.context = context;
        this.articulos_por_precio = articulos_por_precio;

        for (int i = 0; i < jsonArticulos.names().length() ; i++){
            try {
                JSONObject objArt = jsonArticulos.getJSONObject(jsonArticulos.names().getString(i));

                if(object.length() > 0){
                    if (object.has(objArt.getString("precioVenta"))){
                        object.getJSONObject(objArt.getString("precioVenta")).getJSONArray("array").put(objArt.getString("id"));
                        String total = objArt.getString("cantidad");
                        total = String.valueOf(Integer.parseInt(total) +
                                Integer.parseInt(object.getJSONObject(objArt.getString("precioVenta")).getString("total")));
                        object.getJSONObject(objArt.getString("precioVenta")).put("total", total);

                    }else {
                        JSONObject obj = new JSONObject();
                        JSONArray arrayID = new JSONArray(); arrayID.put(objArt.getString("id"));
                        String total = objArt.getString("cantidad");

                        obj.put("array", arrayID);
                        obj.put("total", total);
                        object.put(objArt.getString("precioVenta"), obj);
                    }
                }else {
                    JSONObject obj = new JSONObject();
                    JSONArray arrayID = new JSONArray(); arrayID.put(objArt.getString("id"));
                    String total = objArt.getString("cantidad");

                    obj.put("array", arrayID);
                    obj.put("total", total);
                    object.put(objArt.getString("precioVenta"), obj);
                }

            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }

    }
    public int getColor(){
        return color;
    }



    public void actualizar(){
        notifyDataSetChanged();
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_cantidad_precio_existencia, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView precio = holder.precio, cantidadUnitaria = holder.cantidadUnitaria, cantidadTotal = holder.cantidadTotal;
        Button button = holder.button;


        try {
            JSONObject obj = object.getJSONObject(object.names().getString(position));

            precio.setText(object.names().getString(position));

            cantidadUnitaria.setText(String.valueOf(obj.getJSONArray("array").length()));

            cantidadTotal.setText(obj.getString("total"));


            button.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        if(color >= 0){notifyItemChanged(color);}
                        color = holder.getAdapterPosition();
                        articulos_por_precio.segundaVista(object.getJSONObject(object.names().getString(holder.getAdapterPosition())).getJSONArray("array"));
                        notifyItemChanged(color);
                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                }
            });
        } catch (JSONException e) {
            e.printStackTrace();
            generales.toast("error", context);
        }
        if(color >= 0){
            if(position == color){
                if(android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
                    button.setBackgroundDrawable(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_amarillo_suave));
                } else {
                    button.setBackground(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_amarillo_suave));
                }
            } else {
                if(android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
                    button.setBackgroundDrawable(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
                } else {
                    button.setBackground(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
                }
            }
        }else {
            if(android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.JELLY_BEAN) {
                button.setBackgroundDrawable(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
            } else {
                button.setBackground(ContextCompat.getDrawable(context,  R.drawable.cuadro_esq_red_blanco));
            }
        }
    }




    @Override
    public int getItemCount() {
        if (object.length() > 0){
            return object.names().length();
        }else return 0;
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView precio, cantidadUnitaria, cantidadTotal;
        Button button;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            precio = (TextView)itemView.findViewById(R.id.textView381);
            cantidadUnitaria = (TextView)itemView.findViewById(R.id.textView382);
            cantidadTotal = (TextView)itemView.findViewById(R.id.textView383);
            button = (Button) itemView.findViewById(R.id.button117);
        }
    }
}
