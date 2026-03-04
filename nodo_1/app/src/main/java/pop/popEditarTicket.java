package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.editarTicket;

public class popEditarTicket {
    public void showPopupWindow(final View view, editarTicket editarTicket, String provivene) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_ingreso_datos_ticket, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);


        EditText editText = (EditText) popupView.findViewById(R.id.editTextTicketcambios);
        Button   button   = (Button)   popupView.findViewById(R.id.butTicketCambios_pop);

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(editText.length() > 0){
                    editarTicket.getTextPop(editText.getText().toString(), provivene);
                    popupWindow.dismiss();
                }
            }
        });
    }
}
