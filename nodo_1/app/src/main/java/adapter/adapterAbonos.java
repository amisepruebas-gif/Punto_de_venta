package adapter;

import static com.example.nodo_1.principal.jsonPedido;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.pedidos;

import org.json.JSONException;

import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;


public class adapterAbonos extends RecyclerView.Adapter<adapterAbonos.ViewHolder> {
    List<String> list;
    String id = "", indiceRegistro;
    int tamaño = 0;
    EditText itemAnticipoPedidos;
    Context context;
    pedidos pedidos;
    int  b, a;
    public adapterAbonos(
            Context context,
            String id,
            EditText itemAnticipoPedidos,
            String indiceRegistro,
            pedidos pedidos) {
        this.pedidos = pedidos;
        this.context = context;
        this.id = id;
        this.itemAnticipoPedidos = itemAnticipoPedidos;
        this.indiceRegistro = indiceRegistro;
        b = 0;
        try {
            tamaño = jsonPedido.getJSONObject(id).
                    getJSONObject("pagos").length();

            a = jsonPedido.
                    getJSONObject(id).
                    getJSONObject("pedidos").
                    getJSONObject(indiceRegistro).
                    getJSONObject("articulos").length();//articulos

            b = jsonPedido.
                    getJSONObject(id).
                    getJSONObject("pagos").
                    getJSONObject(indiceRegistro).length();//pagos

        } catch (JSONException e) {
            e.printStackTrace();
            toast("error A  " + indiceRegistro);
        }
        ArrayList<String> array = new ArrayList<>();
        for (int i = 0; i < b; i++){
            try {
                String sA = jsonPedido.getJSONObject(this.id).getJSONObject("pagos").getJSONObject(indiceRegistro).
                        getString(String.valueOf(i + 1)).split("ç")[0],
                        sB = jsonPedido.getJSONObject(this.id).getJSONObject("pagos").getJSONObject(indiceRegistro).
                                getString(String.valueOf(i + 1)).split("ç")[1];

                array.add(sB + "ç" + sA);
            } catch (JSONException e) {
                e.printStackTrace();
                toast("error B");
            }
        }
        array.add("");
        list = array;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.abonositem, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }
    void toast(String s){
        generales.toast(s, context); }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        TextView itemAnticipoNo = holder.itemAnticipoNo, itemCantAbonos = holder.itemCantAbonos,
                itemFechaAbonos = holder.itemFechaAbonos, itemVistaNuevoRegAnticipo = holder.itemVistaNuevoRegAnticipo;

        itemAnticipoNo.setText(String.valueOf(position + 1));

       if(position < list.size() - 1){
           llenarTexView(itemCantAbonos, itemFechaAbonos, position);
           itemVistaNuevoRegAnticipo.setVisibility(View.GONE );
       }else {
           itemVistaNuevoRegAnticipo.setVisibility(View.VISIBLE);
           itemCantAbonos.setText(itemAnticipoPedidos.getText().toString());
           itemFechaAbonos.setText(DateFormat.getDateTimeInstance().format(new Date()));
       }

    }
    public String cantArticulos(){
        return String.valueOf(a);
    }
    @Override
    public int getItemCount() {
        return list.size();
    }


    public List<String> getList() {
        return list;
    }


    public String getId(){
        return id;
    }

    public String getTamaño(){
        return String.valueOf(tamaño);
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        TextView itemAnticipoNo, itemCantAbonos, itemFechaAbonos, itemVistaNuevoRegAnticipo;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            itemVistaNuevoRegAnticipo = (TextView)itemView.findViewById(R.id.itemVistaNuevoRegAnticipo);
            itemAnticipoNo = (TextView)itemView.findViewById(R.id.itemAnticipoNo);
            itemCantAbonos = (TextView)itemView.findViewById(R.id.itemCantAbonos);
            itemFechaAbonos = (TextView)itemView.findViewById(R.id.itemFechaAbonos);
        }
    }
    private void llenarTexView(TextView itemCantAbonos, TextView itemFechaAbonos, int position){
        try {
            String sA = jsonPedido.getJSONObject(this.id).getJSONObject("pagos").getJSONObject(indiceRegistro).
                    getString(String.valueOf(position + 1)).split("ç")[0],
            sB = jsonPedido.getJSONObject(this.id).getJSONObject("pagos").getJSONObject(indiceRegistro).
                    getString(String.valueOf(position + 1)).split("ç")[1];
            itemCantAbonos.setText(sA);

            itemFechaAbonos.setText(sB);
        } catch (JSONException e) {
            e.printStackTrace();
            toast("error C");
        }
    }
}
