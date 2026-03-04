package pop;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;

import adapter.adapTallas;
import propiedades_articulos.tallas;

public class pop_modificar_talla {

    Context context;
    public void showPopupWindow(final View view, tallas tallas, int index) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_modificar_talla, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        context = popupView.getContext();

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

    /*
        RecyclerView recyclerDerecha = (RecyclerView) popupView.findViewById(R.id.recycler_talla_modificar);
        initRecyclerC(recyclerDerecha);
        adapTallas adapTallas = new adapTallas(tallas, "pop", index);
        recyclerDerecha.setAdapter(adapTallas);
     */
    }


    private void initRecyclerC(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new GridLayoutManager(context, 4));
    }
}
