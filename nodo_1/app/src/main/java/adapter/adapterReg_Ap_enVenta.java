package adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adapterReg_Ap_enVenta extends RecyclerView.Adapter<adapterReg_Ap_enVenta.ViewHolder> {

    JSONArray array = new JSONArray();

    Context context;
    String buscar_por_id;
    public adapterReg_Ap_enVenta(JSONArray array, Context context, String buscar_por_id){
        this.context = context;
        this.array = array;
        this.buscar_por_id = buscar_por_id;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_adap_venta_ap_en_venta, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView
                itemDesHist_pag_3               = holder.itemDesHist_pag_3,
                itemCantHist_pag_3              = holder.itemCantHist_pag_3,
                itemPrecUnHist_pag_3            = holder.itemPrecUnHist_pag_3,
                itemTotalPecUnHist_pag_3        = holder.itemTotalPecUnHist_pag_3,
                var_escrita_o_puesta            = holder.var_escrita_o_puesta,
                id                              = holder.id,
                descripcion                     = holder.descripcion,
                colorSelec                      = holder.colorSelec;

        try {
            JSONObject obj = array.getJSONObject(position);

            itemDesHist_pag_3       .setText(obj.getString("nombrePublico"));
            descripcion             .setText(obj.getString("descripcion"));
            itemPrecUnHist_pag_3    .setText(obj.getString("precio"));
            id                      .setText(obj.getString("id"));
            itemCantHist_pag_3      .setText(obj.getString("cantidad"));
            int cant   = Integer.parseInt(obj.getString("cantidad"));
            int precio = Integer.parseInt(obj.getString("precio"));
            String total = String.valueOf(cant * precio);
            itemTotalPecUnHist_pag_3.setText(total);

            if (!buscar_por_id.equals(obj.getString("id"))){
                colorSelec.setVisibility(View.GONE);
            }else colorSelec.setVisibility(View.VISIBLE);

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getItemCount() {
        return array.length();
    }


    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView itemDesHist_pag_3, itemCantHist_pag_3 ,itemPrecUnHist_pag_3, itemTotalPecUnHist_pag_3, var_escrita_o_puesta, id, descripcion;
        TextView arriculoBuscadoPorID_barrRoja, lineaRegAdapVenta;
        TextView colorSelec;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            itemDesHist_pag_3           = (TextView) itemView.findViewById(R.id.itemDesHist_pag_3_a);
            itemPrecUnHist_pag_3        = (TextView) itemView.findViewById(R.id.itemPrecUnHist_pag_3_a);
            itemCantHist_pag_3          = (TextView)itemView.findViewById(R.id.itemCantHist_pag_3_a);
            itemTotalPecUnHist_pag_3    = (TextView)itemView.findViewById(R.id.itemTotalPecUnHist_pag_3_a);
            var_escrita_o_puesta        = (TextView)itemView.findViewById(R.id.itemDesHist_pag__a);
            id                          = (TextView)itemView.findViewById(R.id.itemDesHist_pag_2_a);

            arriculoBuscadoPorID_barrRoja   = (TextView) itemView.findViewById(R.id.textViewColor_regVenta_a);

            descripcion = (TextView) itemView.findViewById(R.id.itemDesHist_pag__a);

            lineaRegAdapVenta       = (TextView) itemView.findViewById(R.id.lineaRegAdapVenta_a);

            colorSelec                  = (TextView)itemView.findViewById(R.id.textViewColor_regVenta_a);
        }
    }
}
