package adapter;

import android.content.Context;
import android.graphics.Typeface;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;


import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;

public class adap_selec_talla_parte_2 extends RecyclerView.Adapter<adap_selec_talla_parte_2.ViewHolder> {

    JSONArray array;
    Context context;
    public adap_selec_talla_parte_2(JSONArray array, Context context){
        this.context = context;
        this.array = array;
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
        Button but_texto = holder.but_texto;
        try {
            but_texto.setText(array.getString(position));
            but_texto.setTextColor(context.getColor(R.color.azulverde));
            but_texto.setTypeface(null, Typeface.BOLD);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        return array.length();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button but_texto;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            but_texto  = (Button) itemView.findViewById(R.id.button86);
        }
    }
}
