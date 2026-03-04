package adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;

import java.util.ArrayList;
import java.util.List;

import pop.pop_but_opcionTicket;

public class adapEnturno extends RecyclerView.Adapter<adapEnturno.ViewHolder> {
    List<String> list = new ArrayList<>();
    principal principal;
    Context context;
    public adapEnturno(principal principal, List<String> list, Context context){
        this.context = context;
        this.principal = principal;
        this.list = list;
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.adap_en_turno, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button button  = holder.button;
        button.setText(list.get(position));
        button.setOnClickListener(new View.OnClickListener() {//
            @Override
            public void onClick(View v) {
                principal.enTurnoSelec(list.get(holder.getAdapterPosition()));
                if(list.get(holder.getAdapterPosition()).equals("VALERIA")){
                    pop.pop_but_opcionTicket popButOpcionTicket = new pop_but_opcionTicket();
                    popButOpcionTicket.showPopupWindow(v, principal);
                }
            }
        });
    }

    @Override
    public int getItemCount() {
        return list.size();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        Button button;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            button = (Button) itemView.findViewById(R.id.button6);
        }
    }
}
