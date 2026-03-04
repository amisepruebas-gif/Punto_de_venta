package adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.buscar_por_id;

import org.json.JSONArray;

public class adapterBusquedaPorID_1 extends RecyclerView.Adapter<adapterBusquedaPorID_1.ViewHolder> {
    Context context;
    JSONArray array = new JSONArray();
    String id;
    buscar_por_id buscar_por_id;
    public adapterBusquedaPorID_1(Context context, JSONArray arrays, String id, buscar_por_id buscar_por_id){
        this.buscar_por_id = buscar_por_id;
        this.id = id;
        this.array = arrays;
        this.context = context;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.recyler_venta_por_id_principal, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        RecyclerView recyclerView = holder.recyclerView;
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context));
        adapterHistorialDos adapterHistorialDos = new adapterHistorialDos(array, context, null, id, null,null, "");
        recyclerView.setAdapter(adapterHistorialDos);
    }

    @Override
    public int getItemCount() {
        return 1;
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        RecyclerView recyclerView;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            recyclerView = (RecyclerView) itemView.findViewById(R.id.recycler_busquedaID_2);
        }
    }
}
